import * as crypto from 'crypto';
import { trimEnd } from 'lodash';

export function SecureToken(): string {
  const bytes = crypto.randomBytes(16);
  const encodeBytes = bytes.toString('base64');
  return trimEnd(encodeBytes, '=');
}
