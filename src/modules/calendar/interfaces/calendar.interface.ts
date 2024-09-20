import { ProviderType } from '@prisma/client';
import { User as UserInterface } from '@modules/user/interfaces/user.interface';

export enum EventProvider {
  ZENITH = 'ZENITH',
  GOOGLE = 'GOOGLE',
  MICROSOFT = 'MICROSOFT',
}

export interface AvailableCalendarWeekdays {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

export interface Calendar {
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
  availableStartTime?: Date | string;
  availableEndTime?: Date | string;
  availableWeekDays: number;
  availableWeekDaysPretty?: AvailableCalendarWeekdays;
  isDisabled: boolean;
  sourceCalendarVisibility?: CalendarVisibility;
  // targetCalendarVisibility?: CalendarVisibility[];
  calendarNameUnique: string;
}

export interface Attendee {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  eventId: number;
  userId: number | null;
  email: string;
}

export interface CalendarEvent {
  id: number | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  provider: EventProvider;
  from: Date | string;
  to: Date | string;
  title?: string;
  details?: string;
  eventLink: string;
  createdById: number | string;
  creatorEmail?: string;
  creatorDisplayName?: string;
  metadata?: any;
  calendar: Calendar;
  zenithEventId?: string | number;
  gEventId?: string | number;
  attendees?: Attendee[];
}

export interface EventByDateReponse {
  events: CalendarEvent[];
  userInfo: UserInterface | null;
}

export interface CalendarVisibility {
  id: number | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  userId: number;
  sourceId: number;
  // targetId: number;
  showAs?: string;
}
