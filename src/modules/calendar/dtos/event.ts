import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateEventDTO {
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsNotEmpty()
  @IsNumber()
  calendarId: number;

  @IsNotEmpty()
  from: Date;

  @IsNotEmpty()
  to: Date;

  @IsString()
  details: string;
}
