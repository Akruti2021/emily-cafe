import crypto from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../middleware/errorhandler';
import { requireBranchPermission } from '../organization/branch-access';

interface OrderRow extends RowDataPacket {
  id: string;
  branchId: string;
  status: string;
}

const allowedNext: Record<string, string[]> = {
  New: ['Accepted', 'Cancelled'],
  Accepted: ['Preparing', 'Cancelled'],
  Preparing: ['Ready', 'Cancelled'],
  Ready: ['Completed'],
  Completed: [],
  Cancelled: [],
};

export async function listKots(userId: string, branchId: string) {
  await requireBranchPermission(userId, branchId, 'kots.view');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT k.id, k.branch_id AS branchId, k.order_id AS orderId,
            k.kot_number AS kotNumber, k.status, k.sent_at AS sentAt,
            k.ready_at AS readyAt, k.sent_by_id AS sentById,
            o.order_number AS orderNumber, t.table_number AS tableNumber,
            sender.name AS sentBy,
            JSON_ARRAYAGG(JSON_OBJECT(
              'id', ki.id, 'orderItemId', ki.order_item_id,
              'name', oi.item_name_snapshot, 'quantity', ki.quantity,
              'status', ki.status, 'instructions', ki.instructions
            )) AS items
       FROM kots k
       JOIN orders o ON o.id = k.order_id AND o.branch_id = k.branch_id
       LEFT JOIN restaurant_tables t ON t.id = o.table_id
       JOIN users sender ON sender.id = k.sent_by_id
       JOIN kot_items ki ON ki.kot_id = k.id
       JOIN order_items oi ON oi.id = ki.order_item_id
      WHERE k.branch_id = ?
      GROUP BY k.id, o.order_number, t.table_number, sender.name
      ORDER BY k.sent_at ASC`,
    [branchId],
  );
  return rows.map((row) => ({
    ...row,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
  }));
}

export async function createKot(userId: string, orderId: string, instructions: Record<string, string>) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query<OrderRow[]>(
      `SELECT id, branch_id AS branchId, status
         FROM orders WHERE id = ? FOR UPDATE`,
      [orderId],
    );
    const order = orders[0];
    if (!order) throw new AppError(404, 'Order not found');
    await requireBranchPermission(userId, order.branchId, 'kots.send');
    if (order.status !== 'PENDING') throw new AppError(409, 'Only pending orders can be sent to the kitchen');
    const [existingTickets] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM kots WHERE order_id = ? LIMIT 1', [orderId],
    );
    if (existingTickets.length) throw new AppError(409, 'A KOT has already been sent for this order');

    const [items] = await connection.query<RowDataPacket[]>(
      'SELECT id, quantity FROM order_items WHERE order_id = ? ORDER BY id', [orderId],
    );
    if (!items.length) throw new AppError(409, 'Cannot send an order with no items to the kitchen');
    const itemIds = new Set(items.map((item) => item.id as string));
    if (Object.keys(instructions).some((id) => !itemIds.has(id))) {
      throw new AppError(400, 'Instructions may only reference items in this order');
    }

    const kotId = crypto.randomUUID();
    const kotNumber = `KOT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    await connection.query(
      `INSERT INTO kots (id, branch_id, order_id, kot_number, status, sent_by_id)
       VALUES (?, ?, ?, ?, 'New', ?)`,
      [kotId, order.branchId, orderId, kotNumber, userId],
    );
    for (const item of items) {
      await connection.query(
        `INSERT INTO kot_items (id, kot_id, order_item_id, quantity, status, instructions)
         VALUES (?, ?, ?, ?, 'New', ?)`,
        [crypto.randomUUID(), kotId, item.id, item.quantity, instructions[item.id as string] ?? null],
      );
    }
    await connection.commit();
    return { id: kotId, branchId: order.branchId, orderId, kotNumber, status: 'New', itemCount: items.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateKotItemStatus(userId: string, itemId: string, nextStatus: string) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT ki.status AS itemStatus, ki.kot_id AS kotId, k.branch_id AS branchId
         FROM kot_items ki JOIN kots k ON k.id = ki.kot_id
        WHERE ki.id = ? FOR UPDATE`,
      [itemId],
    );
    const item = rows[0];
    if (!item) throw new AppError(404, 'KOT item not found');
    const access = await requireBranchPermission(userId, item.branchId, 'kots.manage');
    if (!allowedNext[item.itemStatus]?.includes(nextStatus)) {
      throw new AppError(409, `KOT item cannot move from ${item.itemStatus} to ${nextStatus}`);
    }
    if (nextStatus === 'Cancelled' && access.role === 'KITCHEN_STAFF') {
      throw new AppError(403, 'Only a branch manager can cancel a KOT item');
    }

    await connection.query('UPDATE kot_items SET status = ? WHERE id = ?', [nextStatus, itemId]);
    const [items] = await connection.query<RowDataPacket[]>(
      'SELECT status FROM kot_items WHERE kot_id = ?', [item.kotId],
    );
    const activeItems = items.filter((row) => row.status !== 'Cancelled');
    const progression = ['New', 'Accepted', 'Preparing', 'Ready', 'Completed'];
    const kotStatus = activeItems.length === 0
      ? 'Cancelled'
      : progression.find((status) => activeItems.some((row) => row.status === status)) ?? 'New';
    await connection.query(
      `UPDATE kots SET status = ?, ready_at =
         CASE WHEN ? IN ('Ready', 'Completed') THEN COALESCE(ready_at, CURRENT_TIMESTAMP) ELSE ready_at END
       WHERE id = ?`,
      [kotStatus, kotStatus, item.kotId],
    );
    await connection.commit();
    return { id: itemId, status: nextStatus, kotStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
