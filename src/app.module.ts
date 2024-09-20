import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './common/services/prisma.service';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { AuthModule } from '@modules/auth/auth.module';
import { UserModule } from '@modules/user/user.module';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from '@modules/auth/services/auth.service';
import logConfig from './config/log.config';
import authConfig from './config/auth.config';
import pino from 'pino';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import mailerConfig from './config/mailer.config';
import appConfig from './config/app.config';
import MulterGoogleCloudStorage from 'multer-cloud-storage';
import { MulterModule } from '@nestjs/platform-express';
import { CalendarModule } from './modules/calendar/calendar.module';
import { CalendarService } from './modules/calendar/services/calendar.service';
import storageConfig from './config/storage.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [authConfig, logConfig, appConfig, mailerConfig, storageConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          pinoHttp: {
            level: configService.get<string>('log.level'),
            transport:
              configService.get<boolean>('log.pretty') == true
                ? {
                    target: 'pino-pretty',
                    options: { colorize: true },
                  }
                : undefined,
            stream: pino.destination({
              dest: configService.get<string | number>('log.dest'),
              minLength: configService.get<number>('log.bufferMinLength'),
            }),
          },
        };
      },
    }),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: new MulterGoogleCloudStorage({
          projectId: configService.get<string>('storage.projectId'),
          bucket: configService.get<string>('storage.bucket'),
          keyFilename: configService.get<string>('storage.keyFileName'),
          maxRetries: configService.get<number>('storage.maxRetries'),
          autoRetry: configService.get<boolean>('storage.autoRetry'),
          uniformBucketLevelAccess: configService.get<boolean>(
            'storage.uniformBucketLevelAccess',
          ),
          filename: (res, file, cb) => {
            cb(null, `${file.originalname.replace(/\s/g, '-')}`);
          },
        }),
      }),
      inject: [ConfigService],
    }),
    MailerModule.forRootAsync({
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
    AuthModule,
    UserModule,
    CalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, AuthService, CalendarService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).exclude('/healthz');
  }
}
