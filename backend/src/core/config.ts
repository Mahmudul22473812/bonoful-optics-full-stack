import 'dotenv/config';
import { z } from 'zod';

export const config = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  DATA_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
  FILE_ROOT: z.string().default('./storage'),
  SMTP_URL: z.string().optional(),
  SMS_WEBHOOK_URL: z.url().optional(),
  SMS_WEBHOOK_TOKEN: z.string().min(16).optional(),
  MAIL_FROM: z.email().default('care@bonofuloptics.com'),
  TAX_BPS: z.coerce.number().int().min(0).max(10000).default(0),
  SHIPPING_FEE: z.coerce.number().int().min(0).default(12000),
  FREE_SHIPPING_MINIMUM: z.coerce.number().int().min(0).default(800000),
}).parse(process.env);
