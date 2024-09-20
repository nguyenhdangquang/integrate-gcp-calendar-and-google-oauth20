import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@zenith/common/services/prisma.service';
import { AuthService } from './auth.service';
import { Algorithm } from 'jsonwebtoken';
import { UserService } from '@zenith/modules/user/services/user.service';
import { LoggerModule } from 'nestjs-pino';
import authConfig from '@zenith/config/auth.config';
import appConfig from '@zenith/config/app.config';
import mailerConfig from '@zenith/config/mailer.config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';

describe('AuthService', () => {
  let service: AuthService;

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
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it.skip('should be defined', () => {
    expect(service).toBeDefined();
  });
});
