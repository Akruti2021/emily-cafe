import crypto from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../middleware/errorhandler';
import { requireBranchPermission } from '../organization/branch-access';

async function getRestaurantId(userId: string, branchId: string, permission: 'orders.view' | 'orders.create') {
  const access = await requireBranchPermission(userId, branchId, permission);
  return access.restaurantId;
}

export async function listCustomers(userId: string, branchId: string, search?: string) {
  const restaurantId = await getRestaurantId(userId, branchId, 'orders.view');
  const term = search?.trim();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, phone, email, notes, created_at AS createdAt, updated_at AS updatedAt
       FROM customers WHERE restaurant_id = ? AND status = 'active'
         AND (? IS NULL OR name LIKE ? OR phone LIKE ? OR email LIKE ?)
      ORDER BY name, created_at DESC LIMIT 100`,
    [restaurantId, term || null, `%${term ?? ''}%`, `%${term ?? ''}%`, `%${term ?? ''}%`],
  );
  return rows;
}

export async function createCustomer(userId: string, input: {
  branchId: string; name: string; phone?: string | null; email?: string | null; notes?: string | null;
}) {
  const restaurantId = await getRestaurantId(userId, input.branchId, 'orders.create');
  const id = crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO customers (id, restaurant_id, name, phone, email, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, restaurantId, input.name, input.phone || null, input.email?.toLowerCase() || null, input.notes || null],
    );
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'A customer with this email already exists for this restaurant');
    }
    throw error;
  }
  return { id, name: input.name, phone: input.phone, email: input.email, notes: input.notes, status: 'active' };
}

export async function updateCustomer(userId: string, branchId: string, customerId: string, input: {
  name: string; phone?: string | null; email?: string | null; notes?: string | null;
}) {
  const restaurantId = await getRestaurantId(userId, branchId, 'orders.create');
  try {
    const [result] = await pool.query(
      `UPDATE customers SET name = ?, phone = ?, email = ?, notes = ?
        WHERE id = ? AND restaurant_id = ? AND status = 'active'`,
      [input.name, input.phone || null, input.email?.toLowerCase() || null, input.notes || null, customerId, restaurantId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      const [existing] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM customers WHERE id = ? AND restaurant_id = ? AND status = 'active'", [customerId, restaurantId],
      );
      if (!existing.length) throw new AppError(404, 'Customer not found');
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'A customer with this email already exists for this restaurant');
    }
    throw error;
  }
  return { id: customerId, ...input, phone: input.phone || null, email: input.email?.toLowerCase() || null, notes: input.notes || null };
}

export async function listCustomerOrders(userId: string, branchId: string, customerId: string) {
  const restaurantId = await getRestaurantId(userId, branchId, 'orders.view');
  const [customers] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM customers WHERE id = ? AND restaurant_id = ?', [customerId, restaurantId],
  );
  if (!customers.length) throw new AppError(404, 'Customer not found');
  const [orders] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.order_number AS orderNumber, o.order_type AS orderType, o.status,
            o.subtotal, o.tax_total AS taxTotal, o.discount_total AS discountTotal,
            o.grand_total AS grandTotal, o.created_at AS createdAt, b.name AS branchName
       FROM orders o JOIN branches b ON b.id = o.branch_id
       JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.customer_id = ? AND o.restaurant_id = ?
        AND (r.owner_user_id = ? OR EXISTS (
          SELECT 1 FROM branch_users bu WHERE bu.branch_id = b.id AND bu.user_id = ?
        ))
      ORDER BY o.created_at DESC LIMIT 100`, [customerId, restaurantId, userId, userId],
  );
  return orders;
}
