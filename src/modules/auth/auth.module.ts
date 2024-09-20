import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '@zenith/common/services/prisma.service';
import { UserModule } from '@modules/user/user.module';
import { Algorithm } from 'jsonwebtoken';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './stragegy/jwt.strategy';
import { LocalStrategy } from './stragegy/local.strategy';
import { AuthController } from './controllers/auth.controller';
import { GoogleOauthController } from './controllers/google-auth.controller';
import { GoogleOauthStrategy } from './stragegy/google-oauth.strategy';

@Module({
  imports: [
    forwardRef(() => UserModule),
    JwtModule.registerAsync({
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
  ],
  providers: [
    AuthService,
    PrismaService,
    JwtStrategy,
    LocalStrategy,
    GoogleOauthStrategy,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    JwtModule,
    LocalStrategy,
    GoogleOauthStrategy,
  ],
  controllers: [AuthController, GoogleOauthController],
})
export class AuthModule {}
