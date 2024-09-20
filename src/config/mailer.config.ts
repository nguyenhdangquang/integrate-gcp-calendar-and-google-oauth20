import { registerAs } from '@nestjs/config';

interface MailerConfig {
  transportHost: string;
  transportPort: number;
  transportTls: string;
  authUser: string;
  authPass: string;
  defaultsFrom: string;
}

// Ref: https://stackoverflow.com/a/62890543
export default registerAs(
  'mailer',
  (): MailerConfig => ({
    transportHost: process.env.MAILER_TRANSPORT_HOST,
    transportPort: parseInt(process.env.MAILER_TRANSPORT_PORT) || 25,
    transportTls: process.env.MAILER_TRANSPORT_TLS,
    authUser: process.env.MAILER_AUTH_USER,
    authPass: process.env.MAILER_AUTH_PASS,
    defaultsFrom: process.env.MAILER_DEFAULTS_FROM,
  }),
);
