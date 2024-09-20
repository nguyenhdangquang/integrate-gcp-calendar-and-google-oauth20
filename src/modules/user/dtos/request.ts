import { IsEmail, IsNotEmpty } from 'class-validator';
export class UserBodyRequest {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  password: string;

  @IsEmail()
  email: string;
}

export class LoginRequest {
  @IsNotEmpty()
  password: string;

  @IsEmail()
  email: string;
}
