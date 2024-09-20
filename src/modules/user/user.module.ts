import { forwardRef, Module } from '@nestjs/common';
import { PrismaService } from '@common/services/prisma.service';
import { UserService } from './services/user.service';
import { AuthModule } from '@modules/auth/auth.module';
import { UserController } from './controllers/user.controller';
import { AuthService } from '@modules/auth/services/auth.service';
import { CalendarService } from '../calendar/services/calendar.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UserController],
  providers: [CalendarService, AuthService, UserService, PrismaService],
  exports: [UserService],
})
export class UserModule {}
