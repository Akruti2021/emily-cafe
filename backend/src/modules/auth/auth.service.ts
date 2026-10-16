import argon2 from 'argon2';
import crypto from 'crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorhandler';
import { sendMail } from '../../utils/mailer';
import {
  randomToken,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/tokens';

interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  is_active: number;
}

interface RefreshTokenRow extends RowDataPacket {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

const RESET_MINUTES = 30;

const toPublic = (u: { id: string; name: string; email: string; role: string }) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});

const revokeAllSessions = async (userId: string) => {
  await pool.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
    [userId],
  );
};

async function issueSession(user: { id: string; name: string; email: string; role: string }) {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.REFRESH_DAYS * 864e5);

  await pool.query(
    'INSERT INTO refresh_tokens (id, user_id, expires_at) VALUES (?, ?, ?)',
    [jti, user.id, expiresAt],
  );

  return {
    accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    refreshToken: signRefreshToken({ sub: user.id, jti }),
    user: toPublic(user),
  };
}

export async function signup(input: { name: string; email: string; password: string }) {
  const [existing] = await pool.query<UserRow[]>('SELECT id FROM users WHERE email = ?', [input.email]);
  if (existing.length > 0) throw new AppError(409, 'This email is already registered');

  const userId = crypto.randomUUID();
  const passwordHash = await argon2.hash(input.password);

  await pool.query(
    'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
    [userId, input.name, input.email, passwordHash],
  );

  return issueSession({ id: userId, name: input.name, email: input.email, role: 'USER' });
}

export async function login(email: string, password: string) {
  const invalid = new AppError(401, 'Invalid email or password');
  const [rows] = await pool.query<UserRow[]>('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];

  if (!user) {
    await argon2.hash(password);
    throw invalid;
  }
  if (!user.is_active) throw invalid;
  if (!(await argon2.verify(user.password_hash, password))) throw invalid;

  return issueSession({ id: user.id, name: user.name, email: user.email, role: user.role });
}

export async function refresh(token: string | undefined) {
  if (!token) throw new AppError(401, 'No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const [rows] = await pool.query<RefreshTokenRow[]>('SELECT * FROM refresh_tokens WHERE id = ?', [payload.jti]);
  const row = rows[0];

  if (!row || row.user_id !== payload.sub) throw new AppError(401, 'Invalid refresh token');
  if (new Date(row.expires_at) < new Date()) throw new AppError(401, 'Session expired. Please log in again.');

  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL',
    [row.id],
  );

  if (result.affectedRows === 0) {
    await revokeAllSessions(row.user_id);
    throw new AppError(401, 'Session is no longer valid. Please log in again.');
  }

  const [userRows] = await pool.query<UserRow[]>('SELECT * FROM users WHERE id = ?', [row.user_id]);
  const user = userRows[0];
  if (!user || !user.is_active) throw new AppError(401, 'Account is not available');

  return issueSession({ id: user.id, name: user.name, email: user.email, role: user.role });
}

export async function logout(token: string | undefined) {
  if (!token) return;
  try {
    const { jti } = verifyRefreshToken(token);
    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL', [jti]);
  } catch {}
}

export const logoutAll = (userId: string) => revokeAllSessions(userId);

export async function me(userId: string) {
  const [rows] = await pool.query<UserRow[]>('SELECT id, name, email, role, is_active FROM users WHERE id = ?', [userId]);
  const user = rows[0];
  if (!user || !user.is_active) throw new AppError(401, 'Account is not available');
  return toPublic(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const [rows] = await pool.query<UserRow[]>('SELECT * FROM users WHERE id = ?', [userId]);
  const user = rows[0];
  if (!user) throw new AppError(404, 'User not found');

  if (!(await argon2.verify(user.password_hash, currentPassword))) {
    throw new AppError(400, 'Current password is incorrect');
  }
  if (currentPassword === newPassword) {
    throw new AppError(400, 'New password must be different from current');
  }

  const newHash = await argon2.hash(newPassword);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
  await revokeAllSessions(userId);

  return issueSession({ id: user.id, name: user.name, email: user.email, role: user.role });
}

export async function forgotPassword(email: string) {
  const [rows] = await pool.query<UserRow[]>('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user || !user.is_active) return;

  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.id]);

  const token = randomToken();
  const resetId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + RESET_MINUTES * 60_000);

  await pool.query(
    'INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [resetId, user.id, sha256(token), expiresAt],
  );

  await sendMail(
    user.email,
    'Reset your password',
    `Hello ${user.name},\n\nSet a new password here (valid for ${RESET_MINUTES} minutes):\n${env.CLIENT_URL}/reset-password?token=${token}`,
  );
}

export async function resetPassword(token: string, newPassword: string) {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM password_resets WHERE token_hash = ?', [sha256(token)]);
  const row = rows[0];

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    throw new AppError(400, 'This reset link is invalid or has expired');
  }

  const passwordHash = await argon2.hash(newPassword);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, row.user_id]);
    await connection.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [row.id]);
    await connection.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [row.user_id]);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}