import { registerAs } from '@nestjs/config';

interface AppConfig {
  domain: string;
  apiPrefix: string;
}

export default registerAs(
  'app',
  (): AppConfig => ({
    domain: process.env.APP_DOMAIN,
    apiPrefix: process.env.APP_API_PREFIX,
  }),
);
