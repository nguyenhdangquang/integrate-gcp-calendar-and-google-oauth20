import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import authenticationConfig from '@zenith/config/auth.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
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

  async validate(payload: any) {
    const user = await this.authService.validateJwt(payload);

    if (!user || !user.isActive) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    return user;
  }
}
