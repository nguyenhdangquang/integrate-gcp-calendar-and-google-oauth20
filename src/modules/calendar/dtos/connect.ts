import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ConnectGoogleCalendarDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ReConnectGoogleCalendarDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @IsNotEmpty()
  calendarId: number;
}

export class DisconnectGoogleCalendarDto {
  @IsNumber()
  @IsNotEmpty()
  calendarId: number;
}
