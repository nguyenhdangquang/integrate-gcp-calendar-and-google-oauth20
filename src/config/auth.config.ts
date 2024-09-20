import { registerAs } from '@nestjs/config';
import { readFileSync } from 'fs';

interface AuthConfig {
  jwtExpiresIn: string;
  jwtAlgorithm: string;
  jwtPublicKey: string;
  jwtPrivateKey: string;
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
  tokenSignupExpiresIn: number;
  tokenRecoveryExpiresIn: number;
  tokenResetPasswordExpiresIn: number;
}

export default registerAs(
  'auth',
  (): AuthConfig => ({
    jwtExpiresIn: process.env.AUTH_JWT_EXPIRES_IN || '1w',
    jwtAlgorithm: process.env.AUTH_JWT_ALGORITHM || 'RS256',
    jwtPublicKey: readFileSync(
      <string>process.env.AUTH_JWT_PUBLIC_KEY,
      'utf-8',
    ),
    jwtPrivateKey: readFileSync(
      <string>process.env.AUTH_JWT_PRIVATE_KEY,
      'utf-8',
    ),
    googleClientId: process.env.AUTH_GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: process.env.AUTH_GOOGLE_CALLBACK_URL,
    tokenSignupExpiresIn: 3600,
    tokenRecoveryExpiresIn: 3600,
    tokenResetPasswordExpiresIn: 3600,
  }),
);
