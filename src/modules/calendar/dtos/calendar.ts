import { ProviderType } from '@prisma/client';
import {
  IsAlpha,
  IsArray,
  IsDateString,
  IsEmail,
  IsHexColor,
  IsMilitaryTime,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import {
  AvailableCalendarWeekdays,
  Calendar,
  CalendarVisibility,
} from '../interfaces/calendar.interface';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export class CalendarDto implements Calendar {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  authenticatorId: number;
  email?: string;
  providerType: ProviderType;
  name: string;
  colour?: string;
  profilePictureUrl?: string;
  backgroundPictureUrl?: string;
  logoUrl?: string;
  availableStartTime?: string;
  availableEndTime?: string;
  availableWeekDays: number;
  isDisabled: boolean;
  calendarNameUnique: string;
  // targetCalendarVisibility?: CalendarVisibility[];
  sourceCalendarVisibility?: CalendarVisibility;

  constructor(calendar?: Calendar) {
    this.id = calendar?.id ?? 0;
    this.createdAt = calendar?.createdAt ?? dayjs.utc().toDate();
    this.updatedAt = calendar?.updatedAt ?? dayjs.utc().toDate();
    this.userId = calendar?.userId ?? 0;
    this.authenticatorId = calendar?.authenticatorId ?? 0;
    this.email = calendar?.email;
    this.providerType = calendar?.providerType ?? ProviderType.google;
    this.name = calendar?.name ?? '';
    this.colour = calendar?.colour;
    this.profilePictureUrl = calendar?.profilePictureUrl;
    this.backgroundPictureUrl = calendar?.backgroundPictureUrl;
    this.logoUrl = calendar?.logoUrl;
    this.isDisabled = calendar?.isDisabled;
    this.availableStartTime = calendar?.availableStartTime
      ? dayjs(calendar.availableStartTime).format('HH:mm')
      : '00:00';
    this.availableEndTime = calendar?.availableEndTime
      ? dayjs(calendar.availableEndTime).format('HH:mm')
      : '00:00';
    this.calendarNameUnique = calendar.calendarNameUnique;
    // this.targetCalendarVisibility = calendar.targetCalendarVisibility;
    this.sourceCalendarVisibility = calendar.sourceCalendarVisibility;
  }

  get availableWeekDaysPretty(): AvailableCalendarWeekdays {
    return {
      monday: (this.availableWeekDays & 1) > 0,
      tuesday: (this.availableWeekDays & 2) > 0,
      wednesday: (this.availableWeekDays & 4) > 0,
      thursday: (this.availableWeekDays & 8) > 0,
      friday: (this.availableWeekDays & 16) > 0,
      saturday: (this.availableWeekDays & 32) > 0,
      sunday: (this.availableWeekDays & 64) > 0,
    };
  }
}

export class UpdateCalendarDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsHexColor()
  colour: string;

  @IsOptional()
  @IsUrl()
  profilePictureUrl?: string;

  @IsOptional()
  @IsUrl()
  backgroundPictureUrl?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsMilitaryTime()
  availableStartTime?: string = '09:00';

  @IsOptional()
  @IsMilitaryTime()
  availableEndTime?: string = '17:00';

  @IsOptional()
  availableWeekDaysPretty?: AvailableCalendarWeekdays;

  @IsArray()
  visibilities: UpdateCalendarVisibilityDto[];

  get availableWeekDays(): number {
    let sumWeekDays = 0;
    if (this.availableWeekDaysPretty.monday) {
      sumWeekDays ^= 1;
    }
    if (this.availableWeekDaysPretty.tuesday) {
      sumWeekDays ^= 2;
    }
    if (this.availableWeekDaysPretty.wednesday) {
      sumWeekDays ^= 4;
    }
    if (this.availableWeekDaysPretty.thursday) {
      sumWeekDays ^= 8;
    }
    if (this.availableWeekDaysPretty.friday) {
      sumWeekDays ^= 16;
    }
    if (this.availableWeekDaysPretty.saturday) {
      sumWeekDays ^= 32;
    }
    if (this.availableWeekDaysPretty.sunday) {
      sumWeekDays ^= 64;
    }
    return sumWeekDays;
  }
}

export class UpdateCalendarVisibilityDto {
  @IsNotEmpty()
  @IsNumber()
  calendarId: number;

  @IsAlpha()
  showAs?: string;
}

export class CreateEventDto {
  @IsNotEmpty()
  @IsDateString()
  from: Date;

  @IsNotEmpty()
  @IsString()
  usernameUnique: string;

  @IsNotEmpty()
  @IsDateString()
  to: Date;

  @IsString()
  title?: string;

  @IsEmail()
  attendee?: string;
}

export class UpdateEventBodyDto {
  @IsOptional()
  @IsString()
  gEventId: string;

  @IsNotEmpty()
  @IsDateString()
  from: Date;

  @IsNotEmpty()
  @IsDateString()
  to: Date;

  @IsString()
  @IsOptional()
  title: string;

  @IsString()
  @IsOptional()
  details: string;

  @IsNotEmpty()
  @IsString()
  provider: string;
}
