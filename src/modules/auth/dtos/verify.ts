import { IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export enum VerifyTypeEnum {
  signup = 'signup',
  recovery = 'recovery',
  resetPassword = 'resetPassword',
}

export class VerifyDto {
  @IsString()
  @IsEnum(VerifyTypeEnum)
  type: string;

  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsString()
  redirectTo?: string;
}
