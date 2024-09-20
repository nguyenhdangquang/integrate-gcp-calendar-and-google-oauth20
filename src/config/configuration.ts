import {
  APP_DOMAIN,
  AUTH_JWT_PRIVATE_KEY,
  AUTH_JWT_PUBLIC_KEY,
  AUTH_GOOGLE_CLIENT_ID,
  AUTH_GOOGLE_CLIENT_SECRET,
  AUTH_GOOGLE_CALLBACK_URL,
  STORAGE_BUCKET,
  STORAGE_PROJECT_ID,
  STORAGE_CLIENT_EMAIL,
} from './constants';

export const RequiredEnvVars = [
  APP_DOMAIN,
  AUTH_JWT_PRIVATE_KEY,
  AUTH_JWT_PUBLIC_KEY,
  AUTH_GOOGLE_CLIENT_ID,
  AUTH_GOOGLE_CLIENT_SECRET,
  AUTH_GOOGLE_CALLBACK_URL,
  STORAGE_BUCKET,
  STORAGE_PROJECT_ID,
  STORAGE_CLIENT_EMAIL,
];

export const validateEnvironmentVars = (): void => {
  RequiredEnvVars.forEach((v) => {
    if (!process.env[v]) throw Error(`Missing required env variable ${v}`);
  });
};
