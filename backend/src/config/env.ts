import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(4000),
    DB_HOST: z.string().default('localhost'),
    DB_USER: z.string().default('root'),
    DB_PASSWORD: z.string().default(''),
    DB_NAME: z.string().default('emily_cafe_db'),
    DB_PORT: z.coerce.number().default(3306),
    CLIENT_URL: z.string().default('http://localhost:5173'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    ACCESS_TTL: z.string().default('15m'),
    REFRESH_DAYS: z.coerce.number().default(7),
  })
  .parse(process.env);