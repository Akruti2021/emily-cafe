import fs from 'fs';
import mysql from 'mysql2/promise';
import { env } from './env';

const caPath = env.DB_SSL_CA ?? env.DB_CA_CERT;

export const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: env.DB_PORT,
  ...(env.DB_SSL ? {
    ssl: {
      rejectUnauthorized: true,
      ...(caPath ? { ca: fs.readFileSync(caPath) } : {}),
    },
  } : {}),
  waitForConnections: true,     // Wait for connections instead of throwing an error
  connectionLimit: 10,          // Maximum number of connections in the pool
  queueLimit: 0,
});
