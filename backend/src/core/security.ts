import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from './config';

export const token = () => randomBytes(32).toString('hex');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function matches(value: string, hash: string) { return /^[a-f0-9]{64}$/i.test(hash) && timingSafeEqual(Buffer.from(digest(value),'hex'),Buffer.from(hash,'hex')); }
export function encrypt(value: string | Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',Buffer.from(config.DATA_KEY,'hex'),iv);
  const bytes = Buffer.concat([cipher.update(value),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64');
}
export function decrypt(value: string) {
  const bytes = Buffer.from(value,'base64');
  const decipher = createDecipheriv('aes-256-gcm',Buffer.from(config.DATA_KEY,'hex'),bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));
  return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]);
}
