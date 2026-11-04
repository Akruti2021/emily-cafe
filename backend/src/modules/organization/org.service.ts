import argon2 from 'argon2';
import crypto from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorhandler';
import { signAccessToken, signRefreshToken } from '../../utils/tokens';
import { branchRoles, getAccessibleBranches, requireBranchPermission, type BranchRole } from './branch-access';

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
  const [owned] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM restaurants WHERE id = ? AND owner_user_id = ? AND status = \'active\' LIMIT 1',
    [input.restaurantId, userId],
  );
  if (owned.length === 0) throw new AppError(404, 'Restaurant not found');
  const branchId = crypto.randomUUID();
  await pool.query(
    'INSERT INTO branches (id, restaurant_id, code, name, address, status) VALUES (?, ?, ?, ?, ?, ?)',
    [branchId, input.restaurantId, input.code, input.name, input.address ?? null, 'active'],
  );
  return { id: branchId, ...input, status: 'active' };
}

export const listAccessibleBranches = getAccessibleBranches;

export async function listBranchMembers(userId: string, branchId: string) {
  await requireBranchPermission(userId, branchId, 'members.manage');
  const [rows] = await pool.query<Array<RowDataPacket & {
    id: string; name: string; email: string; role: BranchRole; createdAt: Date;
  }>>(
    'SELECT u.id, u.name, u.email, bu.role, bu.created_at AS createdAt FROM branch_users bu JOIN users u ON u.id = bu.user_id WHERE bu.branch_id = ? ORDER BY u.name, u.email',
    [branchId],
  );
  return rows;
}

export async function addBranchMember(actorId: string, branchId: string, input: { email: string; role: BranchRole }) {
  const access = await requireBranchPermission(actorId, branchId, 'members.manage');
  if (access.role !== 'OWNER' && input.role === 'BRANCH_MANAGER') {
    throw new AppError(403, 'Only a restaurant owner can assign a branch manager');
  }
  if (!branchRoles.includes(input.role as typeof branchRoles[number])) throw new AppError(400, 'Invalid branch role');
  const [users] = await pool.query<UserRow[]>('SELECT id FROM users WHERE email = ? AND is_active = TRUE LIMIT 1', [input.email]);
  const memberId = users[0]?.id;
  if (!memberId) throw new AppError(404, 'Ask this team member to create an account first');
  const [ownerRows] = await pool.query<Array<RowDataPacket & { ownerUserId: string }>>(
    'SELECT r.owner_user_id AS ownerUserId FROM branches b JOIN restaurants r ON r.id = b.restaurant_id WHERE b.id = ?',
    [branchId],
  );
  if (ownerRows[0]?.ownerUserId === memberId) throw new AppError(409, 'The restaurant owner already has access to this branch');
  const id = crypto.randomUUID();
  await pool.query(
    'INSERT INTO branch_users (id, user_id, branch_id, role, assigned_by_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role), assigned_by_id = VALUES(assigned_by_id)',
    [id, memberId, branchId, input.role, actorId],
  );
  return { id: memberId, email: input.email, role: input.role };
}

export async function updateBranchMemberRole(actorId: string, branchId: string, memberId: string, role: BranchRole) {
  const access = await requireBranchPermission(actorId, branchId, 'members.manage');
  if (access.role !== 'OWNER' && role === 'BRANCH_MANAGER') throw new AppError(403, 'Only a restaurant owner can assign a branch manager');
  if (!branchRoles.includes(role as typeof branchRoles[number])) throw new AppError(400, 'Invalid branch role');
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE branch_users bu JOIN branches b ON b.id = bu.branch_id JOIN restaurants r ON r.id = b.restaurant_id SET bu.role = ?, bu.assigned_by_id = ? WHERE bu.user_id = ? AND bu.branch_id = ? AND r.owner_user_id <> ?',
    [role, actorId, memberId, branchId, memberId],
  );
  if (result.affectedRows === 0) throw new AppError(404, 'Branch team member not found');
  return { id: memberId, role };
}

export async function removeBranchMember(actorId: string, branchId: string, memberId: string) {
  const access = await requireBranchPermission(actorId, branchId, 'members.manage');
  if (actorId === memberId) throw new AppError(400, 'You cannot remove your own branch access');
  if (access.role !== 'OWNER') {
    const [targetRows] = await pool.query<Array<RowDataPacket & { role: string }>>(
      'SELECT role FROM branch_users WHERE user_id = ? AND branch_id = ? LIMIT 1',
      [memberId, branchId],
    );
    if (targetRows[0]?.role === 'BRANCH_MANAGER') {
      throw new AppError(403, 'Only a restaurant owner can remove a branch manager');
    }
  }
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE bu FROM branch_users bu JOIN branches b ON b.id = bu.branch_id JOIN restaurants r ON r.id = b.restaurant_id WHERE bu.user_id = ? AND bu.branch_id = ? AND r.owner_user_id <> ?',
    [memberId, branchId, memberId],
  );
  if (result.affectedRows === 0) throw new AppError(404, 'Branch team member not found');
}
