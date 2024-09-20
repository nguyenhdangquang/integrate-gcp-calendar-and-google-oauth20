import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@zenith/common/services/prisma.service';
import { UserService } from '@zenith/modules/user/services/user.service';
import { LoggerModule } from 'nestjs-pino';
import { AuthService } from '../services/auth.service';
import { AuthController } from './auth.controller';
import { Algorithm } from 'jsonwebtoken';
import authConfig from '@zenith/config/auth.config';
import mailerConfig from '@zenith/config/mailer.config';
import appConfig from '@zenith/config/app.config';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: async (configSvc: ConfigService) => ({
            privateKey: configSvc.get<string>('auth.jwtPrivateKey'),
            publicKey: configSvc.get<string>('auth.jwtPublicKey'),
            signOptions: {
              expiresIn: configSvc.get<string>('auth.jwtExpiresIn'),
              algorithm: configSvc.get<Algorithm>('auth.jwtAlgorithm'),
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
      providers: [UserService, AuthService, PrismaService],
      controllers: [AuthController],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it.skip('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
