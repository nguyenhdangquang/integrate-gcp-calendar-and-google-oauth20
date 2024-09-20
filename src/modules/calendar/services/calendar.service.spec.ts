import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import appConfig from '@zenith/config/app.config';
import authConfig from '@zenith/config/auth.config';
import mailerConfig from '@zenith/config/mailer.config';
import { LoggerModule } from 'nestjs-pino';
import { CalendarService } from './calendar.service';
import { Algorithm } from 'jsonwebtoken';
import { PrismaService } from '@zenith/common/services/prisma.service';
import { AuthService } from '@zenith/modules/auth/services/auth.service';
import { UserService } from '@zenith/modules/user/services/user.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import logConfig from '@zenith/config/log.config';

describe('CalendarService', () => {
  let service: CalendarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
          load: [authConfig, logConfig, appConfig, mailerConfig],
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
      providers: [UserService, AuthService, CalendarService, PrismaService],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
