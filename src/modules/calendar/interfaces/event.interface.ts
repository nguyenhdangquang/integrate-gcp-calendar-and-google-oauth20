import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { Attendee } from '../interfaces/calendar.interface';

export interface Event {
  id: number | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  from: Date | string;
  to: Date | string;
  title?: string;
  details?: string;
  eventLink: string;
  createdById: number | string;
  calendarId: number;
  attendees?: Attendee[];
}

export class UpdateEvent {
  @IsNotEmpty()
  calendarId: string | number;

  @IsNotEmpty()
  eventId: string | number;

  @IsOptional()
  @IsString()
  gEventId: string;

  @IsNotEmpty()
  userId: string | number;

  @IsNotEmpty()
  @IsDateString()
  from: Date;

  @IsNotEmpty()
  @IsDateString()
  to: Date;

  @IsOptional()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  details: string;

  @IsNotEmpty()
  @IsString()
  provider: string;
}
