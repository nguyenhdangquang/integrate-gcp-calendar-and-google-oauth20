import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@zenith/common/services/prisma.service';
import { AuthService } from '@zenith/modules/auth/services/auth.service';
import { LoggerModule } from 'nestjs-pino';
import { UserService } from '../services/user.service';
import { UserController } from './user.controller';
import { Algorithm } from 'jsonwebtoken';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import authConfig from '@zenith/config/auth.config';
import mailerConfig from '@zenith/config/mailer.config';
import appConfig from '@zenith/config/app.config';
import { CalendarService } from '@zenith/modules/calendar/services/calendar.service';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      imports: [
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => ({
            privateKey: configService.get('auth.jwtPublicKey'),
            publicKey: configService.get('auth.jwtPrivateKey'),
            signOptions: {
              expiresIn: configService.get<string>('auth.jwtExpiresIn'),
              algorithm: configService.get<Algorithm>('auth.jwtAlgorithm'),
            },
          }),
          inject: [ConfigService],
        }),
        ConfigModule.forRoot({
          load: [authConfig, appConfig, mailerConfig],
        }),
        LoggerModule.forRoot({
          pinoHttp: {
            level: 'debug',
            transport: { target: 'pino-pretty', options: { colorize: true } },
          },
        }),
        MailerModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            transport: {
              host: configService.get<string>('mailer.transportHost'),
              port: configService.get<number>('mailer.transportPort'),
              tls: configService.get<boolean>('mailer.transportTls'),
              auth: {
                user: configService.get<string>('mailer.authUser'),
                pass: configService.get<string>('mailer.authPass'),
              },
            },
            defaults: {
              from: configService.get<string>('mailer.defaultsFrom'),
            },
            template: {
              dir: process.cwd() + '/templates/',
              adapter: new HandlebarsAdapter(),
              options: {
                strict: true,
              },
            },
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [AuthService, CalendarService, UserService, PrismaService],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it.skip('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
