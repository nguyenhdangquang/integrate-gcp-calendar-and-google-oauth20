import {
  Body,
  Controller,
  Post,
  Put,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';

import { UserBodyRequest, LoginRequest } from '../dtos/request';
import { UserService } from '../services/user.service';
import { AuthService } from '@zenith/modules/auth/services/auth.service';
import { LocalStrategy } from '@zenith/modules/auth/stragegy/local.strategy';
import { JwtAuthGuard } from '@zenith/modules/auth/guards/jwt.guard';
import { User } from '../interfaces/user.interface';
import { PinoLogger } from 'nestjs-pino';
import { UpdateProfileDto } from '../dtos/user';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly logger: PinoLogger,
  ) {}

  @Post('/register')
  async register(@Body() userBodyRequest: UserBodyRequest) {
    const response = await this.userService.create(userBodyRequest);
    return response;
  }

  @UseGuards(LocalStrategy)
  @Post('/login')
  async login(@Body() body: LoginRequest) {
    const response = await this.authService.login(body);
    return response;
  }

  /**
   * Get profile for logged in user
   * @param req ExpressJS request
   * @returns User
   */
  @UseGuards(JwtAuthGuard)
  @Get('/me/profile')
  async getProfile(@Req() req): Promise<User> {
    const userId = req.user?.customerId || req.user.id;
    return this.userService.getProfile(+userId);
  }

  /**
   * Update profile for logged in user
   * @param req ExpressJS request
   * @param body UpdateProfileDto
   * @returns User
   */
  @UseGuards(JwtAuthGuard)
  @Put('/me/profile')
  async updateProfile(
    @Req() req,
    @Body() body: UpdateProfileDto,
  ): Promise<User> {
    const userId = req.user?.customerId || req.user.id;
    return this.userService.updateProfile(+userId, body);
  }
}
