import crypto from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../middleware/errorhandler';

interface RecentOrderRow extends RowDataPacket {
  id: string;
  orderNumber: string;
  tableNumber: string | null;
  status: string;
  grandTotal: string | number;
  createdAt: Date;
  itemNames: string | null;
}

export type OrderStatusFilter = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export async function getOrderHistory(
  userId: string,
  options: {
    branchId?: string;
    status?: OrderStatusFilter;
    limit: number;
    offset: number;
  },
) {
  const conditions = [
    "r.status = 'active'",
    'b.status = \'active\'',
    'r.owner_user_id = ?',
  ];
  const values: Array<string | number> = [userId];

  if (options.branchId) {
    conditions.push('o.branch_id = ?');
    values.push(options.branchId);
  }
  if (options.status) {
    conditions.push('o.status = ?');
    values.push(options.status);
  }

  const where = conditions.join(' AND ');
  const [countRows] = await pool.query<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total
       FROM orders o
       JOIN branches b ON b.id = o.branch_id AND b.restaurant_id = o.restaurant_id
       JOIN restaurants r ON r.id = o.restaurant_id
      WHERE ${where}`,
    values,
  );
  const [rows] = await pool.query<RecentOrderRow[]>(
    `SELECT o.id,
            o.order_number AS orderNumber,
            t.table_number AS tableNumber,
            o.status,
            o.grand_total AS grandTotal,
            o.created_at AS createdAt,
            (SELECT GROUP_CONCAT(oi.item_name_snapshot ORDER BY oi.item_name_snapshot SEPARATOR ', ')
               FROM order_items oi
              WHERE oi.order_id = o.id) AS itemNames
       FROM orders o
       JOIN branches b ON b.id = o.branch_id AND b.restaurant_id = o.restaurant_id
       LEFT JOIN restaurant_tables t ON t.id = o.table_id
       JOIN restaurants r ON r.id = o.restaurant_id
      WHERE ${where}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?`,
    [...values, options.limit, options.offset],
  );

  return {
    total: Number(countRows[0]?.total ?? 0),
    items: rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      tableNumber: row.tableNumber,
      title: row.itemNames || `Order ${row.orderNumber}`,
      status: row.status,
      grandTotal: Number(row.grandTotal),
      createdAt: row.createdAt,
    })),
  };
}

interface OwnedOrderRow extends RowDataPacket {
  status: string;
  tableId: string | null;
}

interface DineInTableRow extends RowDataPacket {
  restaurantId: string;
  branchId: string;
  status: string;
}

interface DineInMenuItemRow extends RowDataPacket {
  id: string;
  name: string;
  basePrice: string | number;
  taxRate: string | number;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function createDineInOrder(input: {
  restaurantId: string;
  tableId: string;
  items: Array<{ menuItemId: string; quantity: number }>;
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [tableRows] = await connection.query<DineInTableRow[]>(
      `SELECT r.id AS restaurantId, b.id AS branchId, t.status
         FROM restaurant_tables t
         JOIN dining_areas da ON da.id = t.dining_area_id AND da.status = 'active'
         JOIN branches b ON b.id = da.branch_id AND b.status = 'active'
         JOIN restaurants r ON r.id = b.restaurant_id AND r.status = 'active'
        WHERE t.id = ? AND r.id = ?
        LIMIT 1
        FOR UPDATE`,
      [input.tableId, input.restaurantId],
    );
    const table = tableRows[0];
    if (!table || table.status === 'out_of_service') {
      throw new AppError(404, 'This table is unavailable');
    }

    const menuItemIds = [...new Set(input.items.map(({ menuItemId }) => menuItemId))];
    const placeholders = menuItemIds.map(() => '?').join(', ');
    const [menuItems] = await connection.query<DineInMenuItemRow[]>(
      `SELECT mi.id,
              mi.name,
              mi.base_price AS basePrice,
              mi.tax_rate AS taxRate
         FROM menu_items mi
         JOIN categories c ON c.id = mi.category_id
                           AND c.restaurant_id = mi.restaurant_id
                           AND c.status = 'active'
        WHERE mi.restaurant_id = ?
          AND mi.status = 'active'
          AND mi.id IN (${placeholders})`,
      [input.restaurantId, ...menuItemIds],
    );
    if (menuItems.length !== menuItemIds.length) {
      throw new AppError(400, 'One or more menu items are no longer available');
    }

    const menuById = new Map(menuItems.map((item) => [item.id, item]));
    let subtotal = 0;
    let taxTotal = 0;
    const orderLines = input.items.map(({ menuItemId, quantity }) => {
      const item = menuById.get(menuItemId)!;
      const unitPrice = Number(item.basePrice);
      const lineSubtotal = roundCurrency(unitPrice * quantity);
      subtotal += lineSubtotal;
      taxTotal += roundCurrency(lineSubtotal * Number(item.taxRate) / 100);
      return {
        id: crypto.randomUUID(),
        menuItemId,
        name: item.name,
        unitPrice,
        quantity,
        lineTotal: lineSubtotal,
      };
    });
    subtotal = roundCurrency(subtotal);
    taxTotal = roundCurrency(taxTotal);
    const grandTotal = roundCurrency(subtotal + taxTotal);
    const orderId = crypto.randomUUID();
    const orderNumber = `D${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    await connection.query(
      `INSERT INTO orders (
         id, restaurant_id, branch_id, table_id, order_number, order_type, status,
         subtotal, tax_total, discount_total, grand_total, created_by_id
       ) VALUES (?, ?, ?, ?, ?, 'DINE_IN', 'PENDING', ?, ?, 0, ?, NULL)`,
      [orderId, table.restaurantId, table.branchId, input.tableId, orderNumber, subtotal, taxTotal, grandTotal],
    );

    for (const line of orderLines) {
      await connection.query(
        `INSERT INTO order_items (
           id, order_id, menu_item_id, item_name_snapshot, unit_price, quantity, line_total
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [line.id, orderId, line.menuItemId, line.name, line.unitPrice, line.quantity, line.lineTotal],
      );
    }

    await connection.query(
      `UPDATE restaurant_tables SET status = 'occupied' WHERE id = ?`,
      [input.tableId],
    );
    await connection.commit();

    return {
      id: orderId,
      orderNumber,
      tableId: input.tableId,
      status: 'PENDING',
      subtotal,
      taxTotal,
      grandTotal,
      items: orderLines.map(({ name, quantity, unitPrice, lineTotal }) => ({ name, quantity, unitPrice, lineTotal })),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getRecentOrders(userId: string, branchId?: string) {
  const [rows] = await pool.query<RecentOrderRow[]>(
    `SELECT o.id,
            o.order_number AS orderNumber,
            t.table_number AS tableNumber,
            o.status,
            o.grand_total AS grandTotal,
            o.created_at AS createdAt,
            (SELECT GROUP_CONCAT(oi.item_name_snapshot ORDER BY oi.item_name_snapshot SEPARATOR ', ')
               FROM order_items oi
              WHERE oi.order_id = o.id) AS itemNames
       FROM orders o
       JOIN branches b ON b.id = o.branch_id
       LEFT JOIN restaurant_tables t ON t.id = o.table_id
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
    tableNumber: row.tableNumber,
    title: row.itemNames || `Order ${row.orderNumber}`,
    status: row.status,
    grandTotal: Number(row.grandTotal),
    createdAt: row.createdAt,
  }));
}

const allowedOrderTransitions: Record<string, string[]> = {
  PENDING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
};

export async function updateOrderStatus(
  userId: string,
  orderId: string,
  nextStatus: 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED',
) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<OwnedOrderRow[]>(
      `SELECT o.status, o.table_id AS tableId
         FROM orders o
         JOIN branches b ON b.id = o.branch_id
         JOIN restaurants r ON r.id = b.restaurant_id AND r.id = o.restaurant_id
        WHERE o.id = ? AND r.owner_user_id = ?
        LIMIT 1
        FOR UPDATE`,
      [orderId, userId],
    );
    const order = rows[0];
    if (!order) throw new AppError(404, 'Order not found');
    if (!allowedOrderTransitions[order.status]?.includes(nextStatus)) {
      throw new AppError(409, `Order cannot move from ${order.status} to ${nextStatus}`);
    }

    await connection.query('UPDATE orders SET status = ? WHERE id = ?', [nextStatus, orderId]);

    if ((nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED') && order.tableId) {
      const [openOrders] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM orders
          WHERE table_id = ? AND id <> ? AND status IN ('PENDING', 'PREPARING', 'READY')
          LIMIT 1`,
        [order.tableId, orderId],
      );
      if (openOrders.length === 0) {
        await connection.query(
          `UPDATE restaurant_tables SET status = 'available' WHERE id = ? AND status = 'occupied'`,
          [order.tableId],
        );
      }
    }

    await connection.commit();
    return { id: orderId, status: nextStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
