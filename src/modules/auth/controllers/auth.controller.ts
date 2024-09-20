/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Response } from 'express';
import { VerifyDto, VerifyTypeEnum } from '../dtos/verify';
import { AuthService } from '../services/auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResendConfirmationDto,
  ResetPasswordDto,
} from '../dtos/confirmation';
import { JwtAuthGuard } from '../guards/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly logger: Logger,
    private readonly authService: AuthService,
  ) {}

  /**
   * Logout
   */
  @Post('logout')
  async logout(@Req() req) {}

  /**
   * Refresh to get new access token by
   * sending refresh token
   */
  @Post('refresh')
  async refresh(@Req() req) {}

  /**
   * Verify a registration or a password recovery.
   * Type can be `signup` or `recovery` and the `token`
   * is a token returned from either `/user/register` or `/auth/recover`
   */
  @Get('verify')
  async verify(@Req() req, @Query() query: VerifyDto, @Res() res: Response) {
    const params = {
      type: query.type,
      token: query.token,
      redirectTo: query.redirectTo,
    };

    switch (params.type) {
      case VerifyTypeEnum.signup:
        this.authService.signupVerify(params.token);
        return res.redirect(params.redirectTo);
      case VerifyTypeEnum.recovery:
        this.authService.recoverVerify();
        return res.redirect(params.redirectTo);
      case VerifyTypeEnum.resetPassword:
        return this.authService.resetPasswordVerify(
          params.token,
          params.redirectTo,
          res,
        );
      default:
        throw new BadRequestException('Unsupported verification type');
    }
  }

  /**
   * Resend confirmation link to email
   */
  @Post('resend-confirmation')
  async resendConfirmation(@Body() resendDto: ResendConfirmationDto) {
    return this.authService.resendConfirmation(resendDto.email);
  }

  /**
   * Forgot password
   */
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body);
  }

  /**
   * Reset password
   */
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  /**
   * Change password
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Req() req, @Body() body: ChangePasswordDto) {
    const userId = req.user?.customerId || req.user.id;
    return this.authService.changePassword(userId, body);
  }
}
