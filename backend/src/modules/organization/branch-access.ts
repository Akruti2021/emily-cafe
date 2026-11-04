import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../middleware/errorhandler';

export const branchRoles = [
  'BRANCH_MANAGER',
  'CASHIER',
  'WAITER',
  'KITCHEN_STAFF',
  'INVENTORY_MANAGER',
  'ACCOUNTANT',
] as const;

export type BranchRole = typeof branchRoles[number] | 'OWNER';
export type BranchPermission =
  | 'tables.view'
  | 'tables.manage'
  | 'tables.status'
  | 'orders.view'
  | 'orders.create'
  | 'orders.manage'
  | 'kots.view'
  | 'kots.send'
  | 'kots.manage'
  | 'members.manage';

const permissionsByRole: Record<BranchRole, readonly BranchPermission[]> = {
  OWNER: ['tables.view', 'tables.manage', 'tables.status', 'orders.view', 'orders.create', 'orders.manage', 'kots.view', 'kots.send', 'kots.manage', 'members.manage'],
  BRANCH_MANAGER: ['tables.view', 'tables.manage', 'tables.status', 'orders.view', 'orders.create', 'orders.manage', 'kots.view', 'kots.send', 'kots.manage', 'members.manage'],
  CASHIER: ['tables.view', 'orders.view', 'orders.create', 'orders.manage'],
  WAITER: ['tables.view', 'orders.view', 'orders.create', 'orders.manage', 'kots.view', 'kots.send'],
  KITCHEN_STAFF: ['kots.view', 'kots.manage'],
  INVENTORY_MANAGER: [],
  ACCOUNTANT: [],
};

interface BranchAccessRow extends RowDataPacket {
  branchId: string;
  restaurantId: string;
  role: BranchRole;
}

export function roleHasPermission(role: BranchRole, permission: BranchPermission) {
  return permissionsByRole[role].includes(permission);
}

const selectBranchAccessSql = [
  'SELECT b.id AS branchId, b.restaurant_id AS restaurantId,',
  "       CASE WHEN r.owner_user_id = ? THEN 'OWNER' ELSE bu.role END AS role",
  '  FROM branches b',
  '  JOIN restaurants r ON r.id = b.restaurant_id',
  '  LEFT JOIN branch_users bu ON bu.branch_id = b.id AND bu.user_id = ?',
  " WHERE b.id = ? AND b.status = 'active' AND r.status = 'active'",
  '   AND (r.owner_user_id = ? OR bu.user_id = ?)',
  ' LIMIT 1',
].join(String.fromCharCode(10));

export async function requireBranchPermission(
  userId: string,
  branchId: string,
  permission: BranchPermission,
) {
  const [rows] = await pool.query<BranchAccessRow[]>(
    selectBranchAccessSql,
    [userId, userId, branchId, userId, userId],
  );
  const access = rows[0];
  if (!access) throw new AppError(404, 'Branch not found');
  if (!roleHasPermission(access.role, permission)) throw new AppError(403, 'Forbidden');
  return access;
}

const listBranchesSql = [
  'SELECT b.id, b.restaurant_id AS restaurantId, r.name AS restaurantName, b.code, b.name,',
  "       'OWNER' AS role",
  '  FROM branches b JOIN restaurants r ON r.id = b.restaurant_id',
  " WHERE r.owner_user_id = ? AND r.status = 'active' AND b.status = 'active'",
  'UNION ALL',
  'SELECT b.id, b.restaurant_id AS restaurantId, r.name AS restaurantName, b.code, b.name, bu.role',
  '  FROM branch_users bu',
  "  JOIN branches b ON b.id = bu.branch_id AND b.status = 'active'",
  "  JOIN restaurants r ON r.id = b.restaurant_id AND r.status = 'active'",
  ' WHERE bu.user_id = ? AND r.owner_user_id <> ?',
  'ORDER BY restaurantName, name',
].join(String.fromCharCode(10));

export async function getAccessibleBranches(userId: string) {
  const [rows] = await pool.query<Array<RowDataPacket & {
    id: string;
    restaurantId: string;
    restaurantName: string;
    code: string;
    name: string;
    role: BranchRole;
  }>>(listBranchesSql, [userId, userId, userId]);
  return rows;
}
