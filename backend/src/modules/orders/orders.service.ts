import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

interface RecentOrderRow extends RowDataPacket {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: string | number;
  createdAt: Date;
  itemNames: string | null;
}

export async function getRecentOrders(userId: string, branchId?: string) {
  const [rows] = await pool.query<RecentOrderRow[]>(
    `SELECT o.id,
            o.order_number AS orderNumber,
            o.status,
            o.grand_total AS grandTotal,
            o.created_at AS createdAt,
            (SELECT GROUP_CONCAT(oi.item_name_snapshot ORDER BY oi.item_name_snapshot SEPARATOR ', ')
               FROM order_items oi
              WHERE oi.order_id = o.id) AS itemNames
       FROM orders o
       JOIN branches b ON b.id = o.branch_id
       JOIN restaurants r ON r.id = o.restaurant_id
                         AND r.id = b.restaurant_id
                         AND r.owner_user_id = ?
      WHERE r.status = 'active'
        AND b.status = 'active'
        AND (? IS NULL OR o.branch_id = ?)
      ORDER BY o.created_at DESC
      LIMIT 5`,
    [userId, branchId ?? null, branchId ?? null],
  );

  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    title: row.itemNames || `Order ${row.orderNumber}`,
    status: row.status,
    grandTotal: Number(row.grandTotal),
    createdAt: row.createdAt,
  }));
}