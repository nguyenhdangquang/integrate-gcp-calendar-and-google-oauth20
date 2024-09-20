import { ProviderType } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsUrl } from 'class-validator';
import { TokenPayload } from 'google-auth-library';

export class FindUserBySocialAccountDto {
  provider: ProviderType;
  providerUserId: string;
}

export class CreateUserFromSocialAccountDto {
  accessToken: string;
  refreshToken: string;
  provider: ProviderType;
  providerUserId: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  avatar?: string;
  loginTicket?: TokenPayload;
}

export class UpdateProfileDto {
  @IsNotEmpty()
  displayName: string;

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsUrl()
  @IsOptional()
  avatarUrl?: string;
}

export class UpdateSocialProfileDto {
  providerType: ProviderType;
  providerUserId: string;
  accessToken: string;
  refreshToken: string;
}

export class UploadResponseDto {
  readonly originalName: string;

  readonly fileName: string;

  @IsOptional()
  readonly url: string;
}
