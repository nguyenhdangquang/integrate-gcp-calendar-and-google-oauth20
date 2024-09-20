import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { User } from '@zenith/modules/user/interfaces/user.interface';
import { Profile, Strategy } from 'passport-google-oauth20';
import { AuthService } from '../services/auth.service';

@Injectable()
export class GoogleOauthStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configSvc: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configSvc.get<string>('auth.googleClientId'),
      clientSecret: configSvc.get<string>('auth.googleClientSecret'),
      callbackURL: configSvc.get<string>('auth.googleCallbackUrl'),
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
    });
  }

  authorizationParams(): { [key: string]: string } {
    return {
      access_type: 'offline',
      prompt: 'consent',
    };
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<User | undefined> {
    const user = await this.authService.oldAuthenticateWithGoogle(
      _accessToken,
      _refreshToken,
      profile,
    );

    return user;
  }
}
