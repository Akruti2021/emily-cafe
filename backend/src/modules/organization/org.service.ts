import argon2 from 'argon2';
import crypto from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorhandler';
import { signAccessToken, signRefreshToken } from '../../utils/tokens';

interface UserRow extends RowDataPacket {
  id: string;
}

interface RestaurantRow extends RowDataPacket {
  id: string;
  name: string;
  owner_user_id: string;
  address: string | null;
  status: string;
  created_at: Date;
}

export async function registerRestaurantOnboarding(input: {
  restaurantName: string;
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query<UserRow[]>(
      'SELECT id FROM users WHERE email = ?',
      [input.email],
    );
    if (existing.length > 0) {
      throw new AppError(409, 'This email is already registered');
    }

    const userId = crypto.randomUUID();
    const passwordHash = await argon2.hash(input.password);

    await connection.query(
      'INSERT INTO users (id, name, email, mobile_number, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, input.fullName, input.email, input.phone ?? null, passwordHash, 'OWNER'],
    );

    const restaurantId = crypto.randomUUID();
    await connection.query(
      'INSERT INTO restaurants (id, name, owner_user_id, status) VALUES (?, ?, ?, ?)',
      [restaurantId, input.restaurantName, userId, 'active'],
    );

    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + env.REFRESH_DAYS * 864e5);

    await connection.query(
      'INSERT INTO refresh_tokens (id, user_id, expires_at) VALUES (?, ?, ?)',
      [jti, userId, expiresAt],
    );

    await connection.commit();

    return {
      accessToken: signAccessToken({ sub: userId, email: input.email, role: 'OWNER' }),
      refreshToken: signRefreshToken({ sub: userId, jti }),
      user: {
        id: userId,
        name: input.fullName,
        email: input.email,
        role: 'OWNER',
      },
      restaurant: {
        id: restaurantId,
        name: input.restaurantName,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getUserRestaurants(userId: string) {
  const [rows] = await pool.query<RestaurantRow[]>(
    'SELECT id, name, owner_user_id AS ownerUserId, address, status, created_at AS createdAt FROM restaurants WHERE owner_user_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rows;
}

export async function createBranch(userId: string, input: { restaurantId: string; code: string; name: string; address?: string }) {
  const branchId = crypto.randomUUID();
  await pool.query(
    'INSERT INTO branches (id, restaurant_id, code, name, address, status) VALUES (?, ?, ?, ?, ?, ?)',
    [branchId, input.restaurantId, input.code, input.name, input.address ?? null, 'active'],
  );
  return { id: branchId, ...input, status: 'active' };
}