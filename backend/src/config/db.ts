import mysql from 'mysql2/promise';
import { env } from './env';

export const pool = mysql.createPool({
  host: env.DB_HOST,           //localhost
  user: env.DB_USER,            //root
  password: env.DB_PASSWORD,    //Akruti1212@
  database: env.DB_NAME,        //emily_cafe_db
  port: env.DB_PORT,            //3306
  waitForConnections: true,     // Wait for connections instead of throwing an error
  connectionLimit: 10,          // Maximum number of connections in the pool
  queueLimit: 0,
});