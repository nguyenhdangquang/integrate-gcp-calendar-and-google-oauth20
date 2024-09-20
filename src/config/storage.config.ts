import { registerAs } from '@nestjs/config';

interface StorageConfig {
  projectId: string;
  bucket: string;
  maxRetries: number;
  autoRetry: boolean;
  keyFileName: string;
  uniformBucketLevelAccess: boolean;
}

export default registerAs(
  'storage',
  (): StorageConfig => ({
    projectId: process.env.STORAGE_PROJECT_ID,
    bucket: process.env.STORAGE_BUCKET,
    keyFileName: process.env.STORAGE_KEY_FILENAME,
    maxRetries: parseInt(process.env.STORAGE_MAX_RETRIES) || 10,
    autoRetry: !!process.env.STORAGE_AUTO_RETRY || true,
    uniformBucketLevelAccess:
      !!process.env.STORAGE_UNIFORM_BUCKET_LEVEL_ACCESS || true,
  }),
);
