import { ProviderType } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  token?: string;
  dob: Date;
  email?: string;
  phone: string;
  avatarUrl: string;
  isActive: boolean;
  selectedLanguageId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExternalAuthenticator {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  providerType: ProviderType;
  providerUserId: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
}
