import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

interface MenuRow extends RowDataPacket {
  id: string;
  category_id: string;
  category_name: string;
  category_sort_order: number;
  name: string;
  description: string | null;
  base_price: string | number;
  tax_rate: string | number;
}

export async function getMenu(restaurantId: string) {
  const [rows] = await pool.query<MenuRow[]>(
    `SELECT mi.id, mi.category_id, c.name AS category_name, c.sort_order AS category_sort_order,
            mi.name, mi.description, mi.base_price, mi.tax_rate
       FROM menu_items mi
       JOIN categories c ON c.id = mi.category_id
       JOIN restaurants r ON r.id = mi.restaurant_id
      WHERE mi.restaurant_id = ?
        AND mi.status = 'active'
        AND c.status = 'active'
        AND r.status = 'active'
      ORDER BY c.sort_order ASC, c.name ASC, mi.name ASC`,
    [restaurantId],
  );

  const categories = new Map<string, {
    id: string;
    name: string;
    sortOrder: number;
    items: Array<{ id: string; name: string; description: string | null; price: number; taxRate: number }>;
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
    category.items.push({
      id: row.id,
      name: row.name,
      description: row.description,
      price: Number(row.base_price),
      taxRate: Number(row.tax_rate),
    });
  }

  return [...categories.values()];
}
