import {
  forwardRef,
  Inject,
  Injectable,
  HttpStatus,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { User } from '@modules/user/interfaces/user.interface';
import { UserService } from '@modules/user/services/user.service';
import { LoginRequest } from '@zenith/modules/user/dtos';
import { Profile } from 'passport-google-oauth20';
import _, { first, join, get } from 'lodash';
import { AuthToken, GoogleTokenResponse } from '../dtos/token';
import { ConfigService, ConfigType } from '@nestjs/config';
import { PrismaService } from '@zenith/common/services/prisma.service';
import { PinoLogger } from 'nestjs-pino';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Response } from 'express';
import { MailerService } from '@nestjs-modules/mailer';
import authenticationConfig from '@zenith/config/auth.config';
import mailerConfig from '@zenith/config/mailer.config';
import appConfig from '@zenith/config/app.config';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '@zenith/modules/auth/dtos/confirmation';
import { SecureToken } from '@zenith/common/libs/crypto/crypto';
import { OAuth2Client } from 'google-auth-library';
import { ProviderType } from '@prisma/client';

dayjs.extend(utc);

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

  async validateJwt(payload: any): Promise<User> {
    const userId = get(payload, 'sub') || get(payload, 'userId');

    // Check userId, in case jwt token expired
    if (!userId) {
      return;
    }
    const userData = await this.userService.findOne({ id: +userId });
    const user = {
      ...userData,
    };

    return user as any;
  }

  async sign(payload: any) {
    return this.jwtService.sign(payload);
  }

  async validateUser(email: string, password: string): Promise<User> {
    const userData = await this.userService.findOne({ email });
    if (!userData) {
      return null;
    }
    const isAuthenticated = await argon2.verify(userData.password, password);
    if (isAuthenticated) {
      return userData;
    }
    return null;
  }

  async login(payload: LoginRequest) {
    const { email, password } = payload;
    try {
      const userInfo = await this.validateUser(email, password);
      if (userInfo) {
        return {
          data: {
            jwtAccessToken: await this.sign({
              id: userInfo.id,
              email: userInfo.email,
              sub: userInfo.id,
            }),
            refreshToken: '',
            tokenType: 'bearer',
            expiresIn: this.configService.get<string>('auth.jwtExpiresIn'),
            userInfo,
          },
        };
      } else {
        throw new HttpException(
          'Invalid email or password',
          HttpStatus.UNAUTHORIZED,
        );
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Exchanges authroization code with Google OAuth
   * in return access, refresh token
   * @param code authorization code
   * @returns GoogleTokenResponse contains access token, refreh token and login ticket
   */
  async getGoogleTokenResponse(code: string): Promise<GoogleTokenResponse> {
    const oauth2Client = new OAuth2Client({
      clientId: this.authCfg.googleClientId,
      clientSecret: this.authCfg.googleClientSecret,
      redirectUri: this.authCfg.googleCallbackUrl,
    });
    const tokenResponse = await oauth2Client.getToken(code);
    const certsResponse = await oauth2Client.getFederatedSignonCertsAsync();
    const ticket = await oauth2Client.verifySignedJwtWithCertsAsync(
      tokenResponse.tokens.id_token,
      certsResponse.certs,
    );
    const loginTicket = ticket.getPayload();

    return {
      tokenResponse,
      loginTicket,
    };
  }

  /**
   * Authenticate with Google via authorization code
   */
  async authenticateWithGoogle(code: string): Promise<AuthToken | null> {
    const { tokenResponse, loginTicket } = await this.getGoogleTokenResponse(
      code,
    );

    let user = await this.userService.findOneBySocialAccount({
      provider: 'google',
      providerUserId: loginTicket.sub,
    });
    if (!user) {
      user = await this.userService.createFromSocialAccount({
        accessToken: tokenResponse.tokens.access_token,
        refreshToken: tokenResponse.tokens.refresh_token,
        provider: ProviderType.google,
        providerUserId: loginTicket.sub,
        email: loginTicket.email,
        firstName: loginTicket.given_name,
        lastName: loginTicket.family_name,
        name: loginTicket.name,
        avatar: loginTicket.picture,
        loginTicket: loginTicket,
      });
    }
    this.logger.debug(user, 'got logged in google user');
    const tokenData = await this.generateToken(
      _.set(_.omit(user, 'password'), 'sub', user.id),
    );
    this.logger.debug(tokenData, 'response token');
    await this.userService.updateSocialProfile(user.id, {
      accessToken: tokenResponse.tokens.access_token,
      refreshToken: tokenResponse.tokens.refresh_token,
      providerType: ProviderType.google,
      providerUserId: loginTicket.sub,
    });

    return tokenData;
  }

  async oldAuthenticateWithGoogle(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<User | null> {
    const { id, name, emails, photos } = profile;
    const { familyName, givenName, middleName } = name;

    let user = await this.userService.findOneBySocialAccount({
      provider: 'google',
      providerUserId: id,
    });
    if (!user) {
      user = await this.userService.createFromSocialAccount({
        accessToken: accessToken,
        refreshToken: refreshToken,
        provider: 'google',
        providerUserId: id,
        email: emails[0].value,
        firstName: givenName,
        lastName: familyName,
        name: join([givenName, middleName, familyName], ' '),
        avatar: get(first(photos), 'value', null) || null,
      });
    }
    this.logger.debug('Returning authenticateWithGoogle');
    this.logger.debug(user);

    return user;
  }

  async generateToken(user: User | Express.User): Promise<AuthToken> {
    const accessToken = await this.sign(user);
    const tokenData = {
      jwtAccessToken: accessToken,
      refreshToken: '',
      tokenType: 'bearer',
      expiresIn: this.configService.get<number>('auth.jwtExpiresIn'),
      userInfo: user,
    };
    return tokenData;
  }

  /**
   * Verify a registration
   */
  async signupVerify(token: string) {
    // Find user by confirmation token
    const user = await this.prisma.user
      .findFirst({
        where: {
          confirmationToken: token,
        },
      })
      .catch((err) => {
        this.logger.error('querying user for verifying signup', token, err);
        return;
      });
    if (!user) {
      this.logger.info(
        'failed querying user for verifying signup, not found',
        token,
      );
      return user;
    }

    if (!user.isActive) {
      this.logger.error(user, 'verifying signup, user is unactive');
      return;
    }

    // Check validity of token
    const isValid = await this.isTokenValid(
      token,
      user.confirmationToken,
      this.configService.get<number>('auth.tokenSignupExpiresIn'),
      user.confirmationTokenSentAt,
    );
    if (!isValid) {
      throw new UnauthorizedException('Token has expired or is invalid');
    }
  }

  /**
   * Verify a recover password request
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async recoverVerify() {}

  async isTokenValid(
    actual: string,
    expected: string,
    tokenExp: number,
    sentAt?: Date,
  ): Promise<boolean> {
    if (_.isEmpty(actual) || _.isNil(sentAt)) {
      return false;
    }
    const expiresAt = dayjs(sentAt).add(tokenExp, 'seconds');
    return dayjs.utc().isBefore(expiresAt) && actual == expected;
  }

  /**
   * Resend confirmation link to email
   */
  async resendConfirmation(email: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email,
      },
    });
    if (!user) {
      this.logger.error(
        `failed to resend confiramtion link for user ${email}, user not found`,
      );
      return { success: false };
    }

    const domain = `https://${this.appCfg.domain}`;
    let apiEndpoint = domain;
    if (!_.isEmpty(this.appCfg.apiPrefix)) {
      apiEndpoint = `${apiEndpoint}/${this.appCfg.apiPrefix}`;
    }
    const redirectTo = `${domain}/login`;
    const confirmLink = `${apiEndpoint}/auth/verify?type=signup&token=${user.confirmationToken}&redirectTo=${redirectTo}`;
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
        this.logger.info('resent signup email confirmation', user, success);
      })
      .catch((err) => {
        this.logger.error('resend signup email confirmation failed', user, err);
      });

    return { success: true };
  }

  /**
   * Forgot password and send reset password link
   */
  async forgotPassword(body: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      return { message: `An email has been sent to ${body.email}!` };
    }

    const domain = `https://${this.appCfg.domain}`;
    let apiEndpoint = domain;
    if (!_.isEmpty(this.appCfg.apiPrefix)) {
      apiEndpoint = `${apiEndpoint}/${this.appCfg.apiPrefix}`;
    }

    const resetPassToken = SecureToken();

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetPassToken, resetPassTokenSentAt: dayjs.utc().format() },
    });
    const redirectTo = `${domain}/create-new-password`;
    const resetLink = `${apiEndpoint}/auth/verify?type=resetPassword&token=${resetPassToken}&redirectTo=${redirectTo}`;
    this.mailerService
      .sendMail({
        to: user.email,
        subject: 'Reset password at Zenith',
        template: 'resetPassword',
        context: {
          resetLink,
        },
      })
      .then(async (success) => {
        this.logger.info('resent email reset password', user, success);
      })
      .catch((err) => {
        this.logger.error('resent email reset password failed', user, err);
      });
    return { message: `An email has been sent to ${body.email}!` };
  }

  /**
   * Verify reset password
   */
  async resetPasswordVerify(token: string, redirectTo: string, res: Response) {
    // Find user by reset password token
    const user = await this.prisma.user
      .findFirst({
        where: {
          resetPassToken: token,
        },
      })
      .catch((err) => {
        this.logger.error('querying user for reset password', token, err);
        return;
      });
    if (!user) {
      this.logger.info(
        'failed querying user for reset password, not found',
        token,
      );
      return res.render(
        'token-expired',
        { message: 'Invalid or expired token' },
        (err, html) => {
          res.send(html);
        },
      );
    }

    if (!user.isActive) {
      this.logger.error('reset password, user is unactive', user);
      return;
    }

    // Check validity of token
    const isValid = await this.isTokenValid(
      token,
      user.resetPassToken,
      this.configService.get<number>('auth.tokenResetPasswordExpiresIn'),
      user.resetPassTokenSentAt,
    );
    if (!isValid) {
      return res.render(
        'token-expired',
        { message: 'Invalid or expired token' },
        (err, html) => {
          res.send(html);
        },
      );
    }

    const url = `${redirectTo}?token=${token}`;
    return res.redirect(url);
  }

  /**
   * Reset password
   */
  async resetPassword(body: ResetPasswordDto): Promise<HttpStatus.NO_CONTENT> {
    // Find user by reset password token
    const user = await this.prisma.user.findFirst({
      where: {
        resetPassToken: body.token,
      },
    });

    if (!user) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // Check validity of token
    const isValid = await this.isTokenValid(
      body.token,
      user.resetPassToken,
      this.configService.get<number>('auth.tokenResetPasswordExpiresIn'),
      user.resetPassTokenSentAt,
    );

    if (!isValid) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const newPassword = await argon2.hash(body.newPassword);

    // Update new password and set reset password token to empty
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: newPassword,
        resetPassToken: '',
      },
    });

    return HttpStatus.NO_CONTENT;
  }

  /**
   * Change password
   */
  async changePassword(
    userId: number,
    body: ChangePasswordDto,
  ): Promise<HttpStatus.NO_CONTENT> {
    // Find user by reset password token
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // Check current password
    const isPasswordMatch = await argon2.verify(user.password, body.password);
    if (!isPasswordMatch) {
      throw new HttpException(
        'Current password did not match',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const newPassword = await argon2.hash(body.newPassword);
    // Update new password and set reset password token to empty
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: newPassword,
      },
    });

    return HttpStatus.NO_CONTENT;
  }
}
