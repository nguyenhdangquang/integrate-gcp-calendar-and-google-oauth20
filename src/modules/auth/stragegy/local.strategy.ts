import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { User } from '../../user/interfaces/user.interface';
import { AuthService } from '../services/auth.service';
import authenticationConfig from '@zenith/config/auth.config';
import { ConfigType } from '@nestjs/config';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'jwt-local') {
  constructor(
    @Inject(authenticationConfig.KEY)
    private readonly authConfig: ConfigType<typeof authenticationConfig>,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfig.jwtPublicKey,
      algorithms: [authConfig.jwtAlgorithm],
    });
  }

  async validate(email: string, password: string): Promise<User | undefined> {
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
