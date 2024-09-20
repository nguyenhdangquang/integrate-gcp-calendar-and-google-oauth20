import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AUTH_SESSION_COOKIE_KEY } from '@zenith/config/constants';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { GoogleLoginDto } from '../dtos/googleLogin';
import { AuthToken } from '../dtos/token';
import { GoogleOauthGuard } from '../guards/google-auth.guard';
import { AuthService } from '../services/auth.service';

@Controller('auth/google')
export class GoogleOauthController {
  constructor(
    private authSvc: AuthService,
    private readonly logger: PinoLogger,
  ) {}

  @Post('authorize')
  async googleAuth(@Body() body: GoogleLoginDto) {
    return this.authSvc.authenticateWithGoogle(body.code);
  }

  @Get('')
  @UseGuards(GoogleOauthGuard)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async googleAuthRedirect(@Req() _req) {
    // Guard redirects
  }

  @Get('callback')
  @UseGuards(GoogleOauthGuard)
  async googleAuthRedirectCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthToken | void> {
    if (!req.user) {
      return res.redirect('/login');
    }
    const tokenData = await this.authSvc.generateToken(req.user);
    res.cookie(AUTH_SESSION_COOKIE_KEY, tokenData.jwtAccessToken, {
      httpOnly: true,
      sameSite: 'lax',
    });
    return tokenData;
  }
}
