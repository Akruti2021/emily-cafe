
import crypto from 'crypto';
import { AppError } from '../../middleware/errorhandler';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

interface MenuRow extends RowDataPacket {
  id: string | null;
  category_id: string;
  category_name: string;
  category_sort_order: number;
  name: string | null;
  description: string | null;
  base_price: string | number | null;
  tax_rate: string | number | null;
  item_status: 'active' | 'inactive' | null;
}

export async function getMenu(restaurantId: string, includeInactive = false) {
  const [rows] = await pool.query<MenuRow[]>(
    `SELECT c.id AS category_id,
            c.name AS category_name,
            c.sort_order AS category_sort_order,
            mi.id,
            mi.name,
            mi.description,
            mi.base_price,
            mi.tax_rate,
            mi.status AS item_status
       FROM categories c
       JOIN restaurants r ON r.id = c.restaurant_id
       LEFT JOIN menu_items mi
         ON mi.category_id = c.id
        AND mi.restaurant_id = c.restaurant_id
        AND (? = 1 OR mi.status = 'active')
      WHERE c.restaurant_id = ?
        AND c.status = 'active'
        AND r.status = 'active'
      ORDER BY c.sort_order ASC, c.name ASC, mi.name ASC`,
    [includeInactive ? 1 : 0, restaurantId],
  );

  const categories = new Map<string, {
    id: string;
    name: string;
    sortOrder: number;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      taxRate: number;
      status: 'active' | 'inactive';
    }>;
  }>();

  for (const row of rows) {
    let category = categories.get(row.category_id);

    if (!category) {
      category = {
        id: row.category_id,
        name: row.category_name,
        sortOrder: row.category_sort_order,
        items: [],
      };
      categories.set(row.category_id, category);
    }

    if (row.id !== null) {
      category.items.push({
        id: row.id,
        name: row.name!,
        description: row.description,
        price: Number(row.base_price),
        taxRate: Number(row.tax_rate),
        status: row.item_status!,
      });
    }
  }

  const result = [...categories.values()];
  const ids = result.flatMap((category) => category.items.map((item) => item.id));
  if (!ids.length) return result;
  const marks = ids.map(() => '?').join(',');
  const activeClause = includeInactive ? '' : " AND status = 'active'";
  const [variants] = await pool.query<RowDataPacket[]>(`SELECT id, menu_item_id AS itemId, name, price_delta AS priceDelta, status, sort_order AS sortOrder FROM menu_item_variants WHERE menu_item_id IN (${marks})${activeClause} ORDER BY sort_order, name`, ids);
  const [groups] = await pool.query<RowDataPacket[]>(`SELECT id, menu_item_id AS itemId, name, min_selections AS minSelections, max_selections AS maxSelections, status, sort_order AS sortOrder FROM menu_item_addon_groups WHERE menu_item_id IN (${marks})${activeClause} ORDER BY sort_order, name`, ids);
  const groupIds = groups.map((g) => String(g.id));
  const [addons] = groupIds.length ? await pool.query<RowDataPacket[]>(`SELECT id, group_id AS groupId, name, price_delta AS priceDelta, status, sort_order AS sortOrder FROM menu_item_addons WHERE group_id IN (${groupIds.map(() => '?').join(',')})${activeClause} ORDER BY sort_order, name`, groupIds) : [[] as RowDataPacket[], []];
  const addonMap = new Map<string, RowDataPacket[]>();
  for (const addon of addons) addonMap.set(String(addon.groupId), [...(addonMap.get(String(addon.groupId)) ?? []), addon]);
  const groupMap = new Map<string, RowDataPacket[]>();
  for (const group of groups) groupMap.set(String(group.itemId), [...(groupMap.get(String(group.itemId)) ?? []), { ...group, addons: addonMap.get(String(group.id)) ?? [] }]);
  const variantMap = new Map<string, RowDataPacket[]>();
  for (const variant of variants) variantMap.set(String(variant.itemId), [...(variantMap.get(String(variant.itemId)) ?? []), variant]);
  for (const category of result) for (const item of category.items) Object.assign(item, { variants: variantMap.get(item.id) ?? [], addonGroups: groupMap.get(item.id) ?? [] });
  return result;
}

export async function saveItemOptions(restaurantId: string, itemId: string, userId: string, input: {
  variants: Array<{ id?: string; name: string; priceDelta: number; status: 'active' | 'inactive'; sortOrder: number }>;
  addonGroups: Array<{ id?: string; name: string; minSelections: number; maxSelections: number; status: 'active' | 'inactive'; sortOrder: number; addons: Array<{ id?: string; name: string; priceDelta: number; status: 'active' | 'inactive'; sortOrder: number }> }>;
}) {
  await assertRestaurantOwnership(restaurantId, userId);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [found] = await connection.query<RowDataPacket[]>('SELECT id, base_price AS basePrice FROM menu_items WHERE id = ? AND restaurant_id = ? FOR UPDATE', [itemId, restaurantId]);
    if (!found.length) throw new AppError(404, 'Menu item not found');
    const checkPrice = (delta: number) => { if (Math.round(Number(found[0].basePrice) * 100) + Math.round(delta * 100) < 0) throw new AppError(400, 'Variant price cannot be below zero'); };
    const keepVariants: string[] = [];
    for (const v of input.variants) {
      checkPrice(v.priceDelta); const id = v.id ?? crypto.randomUUID(); keepVariants.push(id);
      await connection.query(`INSERT INTO menu_item_variants (id, menu_item_id, name, price_delta, status, sort_order) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), price_delta=VALUES(price_delta), status=VALUES(status), sort_order=VALUES(sort_order)`, [id,itemId,v.name,v.priceDelta,v.status,v.sortOrder]);
    }
    if (keepVariants.length) await connection.query(`UPDATE menu_item_variants SET status='inactive' WHERE menu_item_id=? AND id NOT IN (${keepVariants.map(()=>'?').join(',')})`, [itemId,...keepVariants]);
    else await connection.query("UPDATE menu_item_variants SET status='inactive' WHERE menu_item_id=?", [itemId]);
    const keepGroups: string[] = [];
    for (const g of input.addonGroups) {
      const groupId = g.id ?? crypto.randomUUID(); keepGroups.push(groupId);
      await connection.query(`INSERT INTO menu_item_addon_groups (id, menu_item_id, name, min_selections, max_selections, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), min_selections=VALUES(min_selections), max_selections=VALUES(max_selections), status=VALUES(status), sort_order=VALUES(sort_order)`, [groupId,itemId,g.name,g.minSelections,g.maxSelections,g.status,g.sortOrder]);
      const keepAddons: string[] = [];
      for (const a of g.addons) { const addonId=a.id??crypto.randomUUID(); keepAddons.push(addonId); await connection.query(`INSERT INTO menu_item_addons (id, group_id, name, price_delta, status, sort_order) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), price_delta=VALUES(price_delta), status=VALUES(status), sort_order=VALUES(sort_order)`, [addonId,groupId,a.name,a.priceDelta,a.status,a.sortOrder]); }
      if (keepAddons.length) await connection.query(`UPDATE menu_item_addons SET status='inactive' WHERE group_id=? AND id NOT IN (${keepAddons.map(()=>'?').join(',')})`, [groupId,...keepAddons]); else await connection.query("UPDATE menu_item_addons SET status='inactive' WHERE group_id=?", [groupId]);
    }
    if (keepGroups.length) await connection.query(`UPDATE menu_item_addon_groups SET status='inactive' WHERE menu_item_id=? AND id NOT IN (${keepGroups.map(()=>'?').join(',')})`, [itemId,...keepGroups]); else await connection.query("UPDATE menu_item_addon_groups SET status='inactive' WHERE menu_item_id=?", [itemId]);
    await connection.commit();
    return { itemId, ...await getMenu(restaurantId, true).then((cats) => ({ item: cats.flatMap((c) => c.items).find((i) => i.id === itemId) })) };
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function getManagementMenu(
  restaurantId: string,
  userId: string,
) {
  await assertRestaurantOwnership(restaurantId, userId);
  return getMenu(restaurantId, true);
}

async function assertRestaurantOwnership(
  restaurantId: string,
  userId: string,
) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id
       FROM restaurants
      WHERE id = ? AND owner_user_id = ? AND status = 'active'
      LIMIT 1`,
    [restaurantId, userId],
  );

  if (rows.length === 0) {
    throw new AppError(404, 'Restaurant not found');
  }
}

export async function createCategory(
  restaurantId: string,
  userId: string,
  input: { name: string; sortOrder?: number },
) {
  await assertRestaurantOwnership(restaurantId, userId);

  const id = crypto.randomUUID();

  await pool.query(
    `INSERT INTO categories (id, restaurant_id, name, sort_order, status)
     VALUES (?, ?, ?, ?, 'active')`,
    [id, restaurantId, input.name, input.sortOrder ?? 0],
  );

  return {
    id,
    restaurantId,
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
    status: 'active',
  };
}

export async function updateCategory(
  restaurantId: string,
  categoryId: string,
  userId: string,
  input: {
    name?: string;
    sortOrder?: number;
    status?: 'active' | 'inactive';
  },
) {
  await assertRestaurantOwnership(restaurantId, userId);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM categories
      WHERE id = ? AND restaurant_id = ?
      LIMIT 1`,
    [categoryId, restaurantId],
  );

  if (rows.length === 0) {
    throw new AppError(404, 'Category not found');
  }

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }

  if (input.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    values.push(input.sortOrder);
  }

  if (input.status !== undefined) {
    updates.push('status = ?');
    values.push(input.status);
  }

  values.push(categoryId, restaurantId);

  await pool.query(
    `UPDATE categories
        SET ${updates.join(', ')}
      WHERE id = ? AND restaurant_id = ?`,
    values,
  );

  return { id: categoryId, ...input };
}

async function assertCategoryBelongsToRestaurant(
  categoryId: string,
  restaurantId: string,
) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id
       FROM categories
      WHERE id = ? AND restaurant_id = ? AND status = 'active'
      LIMIT 1`,
    [categoryId, restaurantId],
  );

  if (rows.length === 0) {
    throw new AppError(400, 'Active category not found for this restaurant');
  }
}

export async function createMenuItem(
  restaurantId: string,
  userId: string,
  input: {
    categoryId: string;
    name: string;
    description?: string | null;
    basePrice: number;
    taxRate?: number;
  },
) {
  await assertRestaurantOwnership(restaurantId, userId);
  await assertCategoryBelongsToRestaurant(input.categoryId, restaurantId);

  const id = crypto.randomUUID();
  const taxRate = input.taxRate ?? 0;

  await pool.query(
    `INSERT INTO menu_items
      (id, restaurant_id, category_id, name, description, base_price, tax_rate, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      id,
      restaurantId,
      input.categoryId,
      input.name,
      input.description ?? null,
      input.basePrice,
      taxRate,
    ],
  );

  return {
    id,
    restaurantId,
    categoryId: input.categoryId,
    name: input.name,
    description: input.description ?? null,
    basePrice: input.basePrice,
    taxRate,
    status: 'active',
  };
}

export async function updateMenuItem(
  restaurantId: string,
  itemId: string,
  userId: string,
  input: {
    categoryId?: string;
    name?: string;
    description?: string | null;
    basePrice?: number;
    taxRate?: number;
    status?: 'active' | 'inactive';
  },
) {
  await assertRestaurantOwnership(restaurantId, userId);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id
       FROM menu_items
      WHERE id = ? AND restaurant_id = ?
      LIMIT 1`,
    [itemId, restaurantId],
  );

  if (rows.length === 0) {
    throw new AppError(404, 'Menu item not found');
  }

  if (input.categoryId !== undefined) {
    await assertCategoryBelongsToRestaurant(input.categoryId, restaurantId);
  }

  const columns: Record<string, string> = {
    categoryId: 'category_id',
    name: 'name',
    description: 'description',
    basePrice: 'base_price',
    taxRate: 'tax_rate',
    status: 'status',
  };

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  for (const [key, column] of Object.entries(columns)) {
    if (input[key as keyof typeof input] !== undefined) {
      updates.push(`${column} = ?`);
      values.push(input[key as keyof typeof input] as string | number | null);
    }
  }

  values.push(itemId, restaurantId);

  await pool.query(
    `UPDATE menu_items
        SET ${updates.join(', ')}
      WHERE id = ? AND restaurant_id = ?`,
    values,
  );

  return { id: itemId, ...input };
}
