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
    DB_NAME: z.string().default('defaultdb'),
    DB_PORT: z.coerce.number().default(3306),
    DB_SSL: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
    DB_SSL_CA: z.string().optional(),
    DB_CA_CERT: z.string().optional(),
    CLIENT_URL: z.string().default('http://localhost:3000'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    ACCESS_TTL: z.string().default('15m'),
    REFRESH_DAYS: z.coerce.number().default(7),
  })
  .parse(process.env);
