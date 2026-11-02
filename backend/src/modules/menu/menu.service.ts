
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

  return [...categories.values()];
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
