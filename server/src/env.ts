import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  PORT: z.coerce.number().int().positive().default(4200),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_DIST: z.string().optional(),
});

export const env = envSchema.parse(process.env);
