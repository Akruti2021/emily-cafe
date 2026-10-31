import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

interface DashboardStatsRow extends RowDataPacket {
  activeDishCount: number | string;
  totalOrderCount: number | string;
  recordedOrderTotal: number | string;
  todayOrderCount: number | string;
  todayCompletedOrderCount: number | string;
  todayPendingOrderCount: number | string;
}

interface MonthlyOrderTotalRow extends RowDataPacket {
  month: number | string;
  total: number | string;
}

export async function getStats(userId: string) {
  const [rows] = await pool.query<DashboardStatsRow[]>(
    `SELECT
       (SELECT COUNT(*)
          FROM menu_items mi
          JOIN categories c ON c.id = mi.category_id
                            AND c.restaurant_id = mi.restaurant_id
         WHERE mi.status = 'active'
           AND c.status = 'active'
           AND EXISTS (
             SELECT 1
               FROM restaurants r
               JOIN branches b ON b.restaurant_id = r.id AND b.status = 'active'
              WHERE r.id = mi.restaurant_id
                AND r.owner_user_id = ?
                AND r.status = 'active'
           )) AS activeDishCount,
       COUNT(o.id) AS totalOrderCount,
       COALESCE(SUM(o.grand_total), 0) AS recordedOrderTotal,
       SUM(CASE WHEN DATE(o.created_at) = CURRENT_DATE() THEN 1 ELSE 0 END) AS todayOrderCount,
       SUM(CASE WHEN DATE(o.created_at) = CURRENT_DATE() AND o.status = 'COMPLETED' THEN 1 ELSE 0 END) AS todayCompletedOrderCount,
       SUM(CASE WHEN DATE(o.created_at) = CURRENT_DATE() AND o.status = 'PENDING' THEN 1 ELSE 0 END) AS todayPendingOrderCount
       FROM restaurants r
       JOIN branches b ON b.restaurant_id = r.id AND b.status = 'active'
       LEFT JOIN orders o ON o.branch_id = b.id AND o.restaurant_id = r.id
      WHERE r.owner_user_id = ?
        AND r.status = 'active'`,
    [userId, userId],
  );

  const [monthlyRows] = await pool.query<MonthlyOrderTotalRow[]>(
    `SELECT MONTH(o.created_at) AS month,
            COALESCE(SUM(o.grand_total), 0) AS total
       FROM restaurants r
       JOIN branches b ON b.restaurant_id = r.id AND b.status = 'active'
       JOIN orders o ON o.branch_id = b.id AND o.restaurant_id = r.id
      WHERE r.owner_user_id = ?
        AND r.status = 'active'
        AND YEAR(o.created_at) = YEAR(CURRENT_DATE())
      GROUP BY MONTH(o.created_at)`,
    [userId],
  );

  const row = rows[0];
  const monthlyTotals = new Map(monthlyRows.map(({ month, total }) => [Number(month), Number(total)]));
  return {
    activeDishCount: Number(row?.activeDishCount ?? 0),
    totalOrderCount: Number(row?.totalOrderCount ?? 0),
    recordedOrderTotal: Number(row?.recordedOrderTotal ?? 0),
    todayOrderCount: Number(row?.todayOrderCount ?? 0),
    todayCompletedOrderCount: Number(row?.todayCompletedOrderCount ?? 0),
    todayPendingOrderCount: Number(row?.todayPendingOrderCount ?? 0),
    monthlyRecordedOrderTotals: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      total: monthlyTotals.get(index + 1) ?? 0,
    })),
    profit: null,
  };
}
