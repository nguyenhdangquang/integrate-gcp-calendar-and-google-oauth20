import {
  BadRequestException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ExternalAuthenticator, Prisma, User } from '@prisma/client';
import { PrismaService } from '@zenith/common/services/prisma.service';
import { AuthService } from '@zenith/modules/auth/services/auth.service';
import { CalendarService } from '@zenith/modules/calendar/services/calendar.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  CreateUserFromSocialAccountDto,
  FindUserBySocialAccountDto,
  UpdateProfileDto,
  UpdateSocialProfileDto,
} from '../dtos/user';
import * as argon2 from 'argon2';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { UserBodyRequest } from '../dtos/request';
import { MailerService } from '@nestjs-modules/mailer';
import { SecureToken } from '@zenith/common/libs/crypto/crypto';
import { ConfigType } from '@nestjs/config';
import authenticationConfig from '@zenith/config/auth.config';
import mailerConfig from '@zenith/config/mailer.config';
import appConfig from '@zenith/config/app.config';
import { User as UserInterface } from '../interfaces/user.interface';
import _ from 'lodash';

dayjs.extend(utc);

@Injectable()
export class UserService {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
    @Inject(forwardRef(() => CalendarService))
    private calendarService: CalendarService,
    @InjectPinoLogger(UserService.name)
    private readonly logger: PinoLogger,
    private prisma: PrismaService,
    private readonly mailerService: MailerService,
    @Inject(authenticationConfig.KEY)
    private readonly authCfg: ConfigType<typeof authenticationConfig>,
    @Inject(mailerConfig.KEY)
    private readonly mailerCfg: ConfigType<typeof mailerConfig>,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  async findOne(
    userWhereUniqueInput: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: userWhereUniqueInput,
    });
  }

  async create(
    user: UserBodyRequest,
  ): Promise<{ success: boolean } | BadRequestException> {
    const { email, firstName, lastName } = user;
    try {
      const userWithEmailTaken = await this.prisma.user.findFirst({
        where: {
          email,
        },
      });
      if (userWithEmailTaken) {
        // Check user social account
        const socialAccount = await this.prisma.externalAuthenticator.findFirst(
          {
            where: {
              userId: userWithEmailTaken.id,
            },
          },
        );
        if (
          _.isEmpty(userWithEmailTaken.password) &&
          !_.isNull(socialAccount)
        ) {
          throw new HttpException(
            'This account is already existed, please try to login by GG instead.',
            HttpStatus.BAD_REQUEST,
          );
        }
        throw new HttpException('Email already taken!', HttpStatus.BAD_REQUEST);
      }
      const username = `${firstName} ${lastName}`
        ?.replace(/[" "]/g, '')
        .toLocaleLowerCase();
      const userHaveSameName = await this.prisma.user.findMany({
        where: {
          usernameUnique: {
            contains: username,
          },
        },
      });

      const displayName = `${user.firstName ?? ''} ${user.lastName ?? ''} ${
        userHaveSameName.length > 0 ? `${userHaveSameName.length}` : ''
      }`.trim();
      const usernameUnique =
        displayName?.replace(/[" "]/g, '') ?? ''.trim().toLocaleLowerCase();
      const hashedPassword = await argon2.hash(user.password);
      const confirmationToken = SecureToken();
      const userCreated = await this.prisma.user.create({
        data: {
          ...user,
          displayName,
          usernameUnique,
          confirmationToken: confirmationToken,
          password: hashedPassword,
        },
      });
      if (userCreated) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const payload = {
          id: userCreated.id,
          email: userCreated.email,
        };

        // TODO: handle transaction with user creation and sending confirmation email
        // Send confirmation email
        const domain = `https://${this.appCfg.domain}`;
        let apiEndpoint = domain;
        if (!_.isEmpty(this.appCfg.apiPrefix)) {
          apiEndpoint = `${apiEndpoint}/${this.appCfg.apiPrefix}`;
        }
        const redirectTo = `${domain}/login`;
        const confirmLink = `${apiEndpoint}/auth/verify?type=signup&token=${confirmationToken}&redirectTo=${redirectTo}`;
        this.mailerService
          .sendMail({
            to: user.email,
            subject: 'Confirm signup at Zenith',
            template: 'signupConfirm',
            context: {
              confirmLink,
            },
          })
          .then(async (success) => {
            this.logger.info('sent signup email confirmation', user, success);
            await this.prisma.user
              .update({
                where: {
                  email: user.email,
                },
                data: {
                  // Reset the confimation token
                  confirmationToken: '',
                  confirmationTokenSentAt: dayjs.utc().format(),
                },
              })
              .then(() => {
                this.logger.info(user, 'updated confirmationTokenSentAt');
              })
              .catch((err) => {
                this.logger.error(
                  'update confirmationTokenSentAt failed',
                  user,
                  err,
                );
              });
          })
          .catch((err) => {
            console.log(this.mailerCfg.transportHost);
            console.log(this.mailerCfg.authUser);
            this.logger.error(err, 'sending signup email confirmation');
          });

        // return {
        //   jwtAccessToken: await this.authService.sign(payload),
        // };
        return {
          success: true,
        };
      }
    } catch (error) {
      throw error;
    }
  }

  async findOneBySocialAccount(
    params: FindUserBySocialAccountDto,
  ): Promise<User | null> {
    const socialProfile = await this.prisma.externalAuthenticator.findFirst({
      where: {
        providerType: params.provider,
        providerUserId: params.providerUserId,
      },
      include: {
        user: true,
      },
    });
    if (!socialProfile) {
      return null;
    }

    return socialProfile.user;
  }

  /**
   * Create user from social account, e.g: google, outlook
   * @param createUserDto user payload data from social identity JWT
   * @returns User
   */
  async createFromSocialAccount(
    createUserDto: CreateUserFromSocialAccountDto,
  ): Promise<User | null> {
    const {
      email,
      phone,
      accessToken,
      refreshToken,
      providerUserId,
      provider,
      firstName,
      lastName,
      avatar,
      loginTicket,
    } = createUserDto;
    this.logger.debug(createUserDto, 'createUserDto');
    const [userNotUniqueEmail] = await Promise.all([
      this.prisma.user.findUnique({
        where: {
          email: createUserDto.email,
        },
      }),
    ]);
    const userHaveSameName = await this.prisma.user.findMany({
      where: {
        usernameUnique: {
          contains: `${firstName ?? ''} ${lastName ?? ''}`
            .replace(/[" "]/g, '')
            .trim()
            .toLocaleLowerCase(),
        },
      },
    });

    const displayName = `${firstName ?? ''} ${lastName ?? ''} ${
      userHaveSameName.length > 0 ? `${userHaveSameName.length}` : ''
    }`.trim();
    const usernameUnique = displayName
      ?.replace(/[" "]/g, '')
      .trim()
      .toLocaleLowerCase();
    if (userNotUniqueEmail) {
      if (!_.isEmpty(userNotUniqueEmail.password)) {
        return userNotUniqueEmail;
      }
      const fieldName = userNotUniqueEmail ? 'Email' : 'Phone';
      const errorMsg = `${fieldName} has already been taken.`;
      throw new HttpException({ message: errorMsg }, HttpStatus.BAD_REQUEST);
    }

    const hashedPassword = await argon2.hash('randompassword');

    const userData = {
      email,
      phone,
      firstName,
      lastName,
      avatarUrl: avatar,
      isActive: true,
      password: hashedPassword,
      displayName,
      usernameUnique,
    };
    const socialProfileData = {
      providerType: provider,
      providerUserId,
      accessToken,
      refreshToken,
    };
    this.logger.debug('creating user from google profile data');
    this.logger.debug(userData, 'userData');
    this.logger.debug(socialProfileData, 'socialProfileData');

    const user = await this.prisma.user.create({
      data: {
        ...userData,
      },
    });

    const socialProfile = await this.prisma.externalAuthenticator.create({
      data: {
        ...socialProfileData,
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });
    this.logger.debug(
      socialProfile,
      `created social profile for user ${user.email}`,
    );

    // Create default calendar
    const calendar = await this.calendarService.getOrCreateCalendar(
      user.id,
      provider,
      socialProfile.id,
      loginTicket,
    );
    this.logger.debug(calendar, `created calendar for user ${user.email}`);

    return user;
  }

  async updateSocialProfile(
    userId: number,
    updateSocialProfile: UpdateSocialProfileDto,
  ): Promise<ExternalAuthenticator | null> {
    this.logger.debug('updating user social profile from google profile data');
    this.logger.debug(updateSocialProfile, 'socialProfile');
    const socialProfile = await this.prisma.externalAuthenticator.update({
      where: {
        userId_providerType_providerUserId: {
          userId: userId,
          providerUserId: updateSocialProfile.providerUserId,
          providerType: updateSocialProfile.providerType,
        },
      },
      data: {
        ...updateSocialProfile,
      },
    });
    return socialProfile;
  }

  async updateProfile(userId: number, data: UpdateProfileDto): Promise<User> {
    const displayName = data.displayName;
    if (displayName) {
      const userDuplicateDisplayName = await this.prisma.user.findFirst({
        where: {
          usernameUnique: displayName
            .replace(/[" "]/g, '')
            .trim()
            .toLocaleLowerCase(),
          id: {
            notIn: userId,
          },
        },
      });
      if (userDuplicateDisplayName) {
        throw new HttpException(
          'This display name already exits',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const user = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        ...data,
        usernameUnique: displayName
          .replace(/[" "]/g, '')
          .trim()
          .toLocaleLowerCase(),
      },
    });

    return user;
  }

  async getProfile(userId: number): Promise<UserInterface> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    return _.omit(user, ['password']);
  }
}
