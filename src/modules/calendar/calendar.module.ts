import { forwardRef, Module } from '@nestjs/common';
import { PrismaService } from '@zenith/common/services/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/services/auth.service';
import { UserService } from '../user/services/user.service';
import { UserModule } from '../user/user.module';
import { CalendarController } from './controllers/calendar.controller';
import { CalendarService } from './services/calendar.service';

@Module({
  imports: [forwardRef(() => UserModule), AuthModule],
  controllers: [CalendarController],
  providers: [CalendarService, PrismaService, AuthService, UserService],
  exports: [CalendarService],
})
export class CalendarModule {}
