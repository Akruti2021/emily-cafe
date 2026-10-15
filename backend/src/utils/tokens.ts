import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessPayload {
  sub: string;
  email: string;
  role: string;
}

export interface RefreshPayload {
  sub: string;
  jti: string;
}

export const signAccessToken = (payload: AccessPayload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TTL,
    algorithm: 'HS256',
  } as SignOptions);

export const signRefreshToken = (payload: RefreshPayload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_DAYS}d`,
    algorithm: 'HS256',
  } as SignOptions);

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as unknown as AccessPayload;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as unknown as RefreshPayload;

export const randomToken = () => crypto.randomBytes(48).toString('hex');
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');