import { registerAs } from '@nestjs/config';

interface LogConfig {
  level: string;
  pretty: boolean;
  bufferLength: number;
  dest: string | number;
}

export default registerAs(
  'log',
  (): LogConfig => ({
    level: process.env.LOG_LEVEL || 'debug',
    pretty: !!process.env.LOG_PRETTY || true,
    bufferLength: parseInt(process.env.LOG_BUFFER_LENGTH) || 4096,
    dest: process.env.LOG_DEST || process.stdout.fd,
  }),
);
