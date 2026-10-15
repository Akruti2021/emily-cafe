import { config } from 'dotenv';
import { z } from 'zod';

config();

export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string(),
    CLIENT_URL: z.string().default('http://localhost:5173'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TTL: z.string().default('15m'),
    REFRESH_DAYS: z.coerce.number().default(7),
  })
  .parse(process.env);