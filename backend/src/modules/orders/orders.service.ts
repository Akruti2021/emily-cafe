import crypto from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../middleware/errorhandler';
import { roleHasPermission, type BranchRole } from '../organization/branch-access';

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
    "(r.owner_user_id = ? OR EXISTS (SELECT 1 FROM branch_users bu WHERE bu.branch_id = o.branch_id AND bu.user_id = ? AND bu.role IN ('BRANCH_MANAGER', 'CASHIER', 'WAITER')))",
  ];
  const values: Array<string | number> = [userId, userId];

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

export async function createPosDineInOrder(
  userId: string,
  input: { branchId: string; tableId: string; items: Array<{ menuItemId: string; quantity: number; variantId?: string; addonIds: string[] }> },
) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [tableRows] = await connection.query<Array<RowDataPacket & {
      restaurantId: string;
      status: string;
      role: BranchRole;
    }>>(
      [
        "SELECT b.restaurant_id AS restaurantId, t.status,",
        "       CASE WHEN r.owner_user_id = ? THEN 'OWNER' ELSE bu.role END AS role",
        "  FROM restaurant_tables t",
        "  JOIN dining_areas da ON da.id = t.dining_area_id AND da.status = 'active'",
        "  JOIN branches b ON b.id = da.branch_id AND b.status = 'active'",
        "  JOIN restaurants r ON r.id = b.restaurant_id AND r.status = 'active'",
        "  LEFT JOIN branch_users bu ON bu.branch_id = b.id AND bu.user_id = ?",
        " WHERE b.id = ? AND t.id = ? AND (r.owner_user_id = ? OR bu.user_id = ?)",
        " LIMIT 1 FOR UPDATE",
      ].join("\n"),
      [userId, userId, input.branchId, input.tableId, userId, userId],
    );
    const table = tableRows[0];
    if (!table) throw new AppError(404, 'Table not found');
    if (!roleHasPermission(table.role, 'orders.create')) throw new AppError(403, 'Forbidden');
    if (table.status !== 'available') {
      throw new AppError(409, 'Choose an available table to start a new POS order');
    }

    const menuItemIds = input.items.map((line) => line.menuItemId);
    const placeholders = menuItemIds.map(() => '?').join(', ');
    const menuSql = [
      "SELECT mi.id, mi.name, mi.base_price AS basePrice, mi.tax_rate AS taxRate",
      "  FROM menu_items mi",
      "  JOIN categories c ON c.id = mi.category_id AND c.restaurant_id = mi.restaurant_id AND c.status = 'active'",
      " WHERE mi.restaurant_id = ? AND mi.status = 'active' AND mi.id IN (" + placeholders + ")",
    ].join("\n");
    const [menuItems] = await connection.query<DineInMenuItemRow[]>(
      menuSql,
      [table.restaurantId, ...menuItemIds],
    );
    if (menuItems.length !== menuItemIds.length) {
      throw new AppError(400, 'One or more menu items are no longer available');
    }

    const menuById = new Map(menuItems.map((item) => [item.id, item]));
    let subtotalCents = 0;
    let taxTotalCents = 0;
    const configured = new Map<string, Array<{ type: 'variant' | 'addon'; id: string; name: string; delta: number }>>();
    for (const line of input.items) {
      const selected: Array<{ type: 'variant' | 'addon'; id: string; name: string; delta: number }> = [];
      if (line.variantId) {
        const [rows] = await connection.query<Array<RowDataPacket & { id: string; name: string; delta: number }>>("SELECT id,name,price_delta AS delta FROM menu_item_variants WHERE id=? AND menu_item_id=? AND status='active'", [line.variantId, line.menuItemId]);
        if (!rows.length) throw new AppError(400, 'Selected variant is unavailable');
        selected.push({ type: 'variant', id: rows[0].id, name: rows[0].name, delta: Number(rows[0].delta) });
      }
      if (line.addonIds.length) {
        const [rows] = await connection.query<Array<RowDataPacket & { id: string; groupId: string; name: string; delta: number }>>(`SELECT a.id, a.group_id AS groupId, a.name, a.price_delta AS delta FROM menu_item_addons a JOIN menu_item_addon_groups g ON g.id=a.group_id WHERE a.id IN (${line.addonIds.map(() => '?').join(',')}) AND g.menu_item_id=? AND a.status='active' AND g.status='active'`, [...line.addonIds, line.menuItemId]);
        if (rows.length !== line.addonIds.length) throw new AppError(400, 'One or more add-ons are unavailable');
        selected.push(...rows.map((row) => ({ type: 'addon' as const, id: row.id, name: row.name, delta: Number(row.delta) })));
      }
      const [groups] = await connection.query<Array<RowDataPacket & { id: string; minSelections: number; maxSelections: number }>>("SELECT id,min_selections AS minSelections,max_selections AS maxSelections FROM menu_item_addon_groups WHERE menu_item_id=? AND status='active'", [line.menuItemId]);
      for (const group of groups) {
        const chosen = selected.filter((option) => option.type === 'addon' && line.addonIds.includes(option.id));
        const groupAddonIds = line.addonIds.length ? (await connection.query<Array<RowDataPacket & { n: number }>>(`SELECT COUNT(*) AS n FROM menu_item_addons WHERE group_id=? AND id IN (${line.addonIds.map(() => '?').join(',')})`, [group.id, ...line.addonIds]))[0][0]?.n ?? 0 : 0;
        if (Number(groupAddonIds) < Number(group.minSelections) || Number(groupAddonIds) > Number(group.maxSelections)) throw new AppError(400, 'Choose the required number of add-ons for each group');
        void chosen;
      }
      configured.set(line.menuItemId, selected);
    }
    const orderLines = input.items.map(({ menuItemId, quantity }) => {
      const item = menuById.get(menuItemId)!;
      if (quantity > 20) throw new AppError(400, 'An item quantity cannot exceed 20');
      const options = configured.get(menuItemId) ?? [];
      const unitPriceCents = Math.round((Number(item.basePrice) + options.reduce((sum, option) => sum + option.delta, 0)) * 100);
      if (unitPriceCents < 0) throw new AppError(400, 'Configured item price cannot be below zero');
      const taxRateBasisPoints = Math.round(Number(item.taxRate) * 100);
      const lineTotalCents = unitPriceCents * quantity;
      const lineTaxCents = Math.round(lineTotalCents * taxRateBasisPoints / 10000);
      subtotalCents += lineTotalCents;
      taxTotalCents += lineTaxCents;
      return {
        id: crypto.randomUUID(),
        menuItemId,
        name: item.name,
        unitPrice: unitPriceCents / 100,
        quantity,
        lineTotal: lineTotalCents / 100,
        customizations: options,
      };
    });
    const subtotal = subtotalCents / 100;
    const taxTotal = taxTotalCents / 100;
    const grandTotal = (subtotalCents + taxTotalCents) / 100;
    const orderId = crypto.randomUUID();
    const orderNumber = 'P' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();

    await connection.query(
      "INSERT INTO orders (id, restaurant_id, branch_id, table_id, order_number, order_type, status, subtotal, tax_total, discount_total, grand_total, created_by_id) VALUES (?, ?, ?, ?, ?, 'DINE_IN', 'PENDING', ?, ?, 0, ?, ?)",
      [orderId, table.restaurantId, input.branchId, input.tableId, orderNumber, subtotal, taxTotal, grandTotal, userId],
    );
    for (const line of orderLines) {
      await connection.query(
        "INSERT INTO order_items (id, order_id, menu_item_id, item_name_snapshot, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [line.id, orderId, line.menuItemId, line.name, line.unitPrice, line.quantity, line.lineTotal],
      );
      for (const option of line.customizations) await connection.query(
        'INSERT INTO order_item_customizations (id, order_item_id, customization_type, variant_id, addon_id, name_snapshot, price_delta_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), line.id, option.type, option.type === 'variant' ? option.id : null, option.type === 'addon' ? option.id : null, option.name, option.delta],
      );
    }
    await connection.query("UPDATE restaurant_tables SET status = 'occupied' WHERE id = ?", [input.tableId]);
    await connection.commit();
    return {
      id: orderId,
      orderNumber,
      tableId: input.tableId,
      status: 'PENDING',
      subtotal,
      taxTotal,
      grandTotal,
      items: orderLines.map(({ name, quantity, unitPrice, lineTotal, customizations }) => ({ name, quantity, unitPrice, lineTotal, customizations: customizations.map(({ name, delta }) => ({ name, priceDelta: delta })) })),
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
      WHERE (r.owner_user_id = ? OR EXISTS (
          SELECT 1 FROM branch_users bu
           WHERE bu.branch_id = o.branch_id AND bu.user_id = ?
             AND bu.role IN ('BRANCH_MANAGER', 'CASHIER', 'WAITER')
        ))
        AND r.status = 'active'
        AND b.status = 'active'
        AND (? IS NULL OR o.branch_id = ?)
      ORDER BY o.created_at DESC
      LIMIT 5`,
    [userId, userId, branchId ?? null, branchId ?? null],
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
        WHERE o.id = ? AND b.status = 'active' AND r.status = 'active'
          AND (r.owner_user_id = ? OR EXISTS (
            SELECT 1 FROM branch_users bu
             WHERE bu.branch_id = o.branch_id AND bu.user_id = ?
               AND bu.role IN ('BRANCH_MANAGER', 'CASHIER', 'WAITER')
          ))
        LIMIT 1
        FOR UPDATE`,
      [orderId, userId, userId],
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
