import { User } from '@zenith/modules/user/interfaces/user.interface';
import { TokenPayload } from 'google-auth-library';
import { GetTokenResponse } from 'google-auth-library/build/src/auth/oauth2client';

export class GoogleTokenResponse {
  tokenResponse: GetTokenResponse;
  loginTicket: TokenPayload;
}

export class AuthToken {
  jwtAccessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  userInfo: Express.User | User;
}
