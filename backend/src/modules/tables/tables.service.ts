import crypto from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AppError } from '../../middleware/errorhandler';

interface DiningAreaRow extends RowDataPacket {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

interface RestaurantTableRow extends RowDataPacket {
  id: string;
  restaurantId: string;
  areaId: string;
  areaName: string;
  tableNumber: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'out_of_service';
  createdAt: Date;
  updatedAt: Date;
}

async function assertOwnedBranch(branchId: string, userId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT b.id
       FROM branches b
       JOIN restaurants r ON r.id = b.restaurant_id
      WHERE b.id = ?
        AND r.owner_user_id = ?
        AND b.status = 'active'
        AND r.status = 'active'
      LIMIT 1`,
    [branchId, userId],
  );

  if (rows.length === 0) throw new AppError(404, 'Branch not found');
}

async function assertUniqueAreaName(branchId: string, name: string, exceptId?: string) {
  const [rows] = exceptId
    ? await pool.query<RowDataPacket[]>(
      `SELECT id FROM dining_areas
        WHERE branch_id = ? AND name = ? AND id <> ? LIMIT 1`,
      [branchId, name, exceptId],
    )
    : await pool.query<RowDataPacket[]>(
      `SELECT id FROM dining_areas WHERE branch_id = ? AND name = ? LIMIT 1`,
      [branchId, name],
    );

  if (rows.length > 0) throw new AppError(409, 'An area with this name already exists');
}

export async function listDiningAreas(branchId: string, userId: string) {
  await assertOwnedBranch(branchId, userId);

  const [rows] = await pool.query<DiningAreaRow[]>(
    `SELECT id,
            branch_id AS branchId,
            name,
            description,
            sort_order AS sortOrder,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
       FROM dining_areas
      WHERE branch_id = ?
      ORDER BY sort_order ASC, name ASC, created_at ASC`,
    [branchId],
  );

  return rows;
}

export async function createDiningArea(
  branchId: string,
  userId: string,
  input: { name: string; description?: string | null },
) {
  await assertOwnedBranch(branchId, userId);
  await assertUniqueAreaName(branchId, input.name);

  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO dining_areas (id, branch_id, name, description)
     VALUES (?, ?, ?, ?)`,
    [id, branchId, input.name, input.description?.trim() || null],
  );

  return {
    id,
    branchId,
    name: input.name,
    description: input.description?.trim() || null,
    sortOrder: 0,
    status: 'active' as const,
  };
}

export async function updateDiningArea(
  branchId: string,
  areaId: string,
  userId: string,
  input: {
    name?: string;
    description?: string | null;
    status?: 'active' | 'inactive';
  },
) {
  await assertOwnedBranch(branchId, userId);

  const [existingRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM dining_areas WHERE id = ? AND branch_id = ? LIMIT 1',
    [areaId, branchId],
  );
  if (existingRows.length === 0) throw new AppError(404, 'Dining area not found');

  const assignments: string[] = [];
  const values: Array<string | null> = [];

  if (input.name !== undefined) {
    await assertUniqueAreaName(branchId, input.name, areaId);
    assignments.push('name = ?');
    values.push(input.name);
  }
  if (input.description !== undefined) {
    assignments.push('description = ?');
    values.push(input.description?.trim() || null);
  }
  if (input.status !== undefined) {
    assignments.push('status = ?');
    values.push(input.status);
  }

  values.push(areaId, branchId);
  await pool.query<ResultSetHeader>(
    `UPDATE dining_areas
        SET ${assignments.join(', ')}
      WHERE id = ? AND branch_id = ?`,
    values,
  );

  const updated = await listDiningAreas(branchId, userId);
  return updated.find((area) => area.id === areaId)!;
}

export async function deleteDiningArea(branchId: string, areaId: string, userId: string) {
  await assertOwnedBranch(branchId, userId);
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM dining_areas WHERE id = ? AND branch_id = ?',
    [areaId, branchId],
  );
  if (result.affectedRows === 0) throw new AppError(404, 'Dining area not found');
}

async function assertActiveDiningArea(branchId: string, areaId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM dining_areas
      WHERE id = ? AND branch_id = ? AND status = 'active'
      LIMIT 1`,
    [areaId, branchId],
  );
  if (rows.length === 0) throw new AppError(404, 'Active dining area not found');
}

async function assertUniqueTableNumber(areaId: string, tableNumber: string, exceptId?: string) {
  const [rows] = exceptId
    ? await pool.query<RowDataPacket[]>(
      `SELECT id FROM restaurant_tables
        WHERE dining_area_id = ? AND table_number = ? AND id <> ? LIMIT 1`,
      [areaId, tableNumber, exceptId],
    )
    : await pool.query<RowDataPacket[]>(
      `SELECT id FROM restaurant_tables
        WHERE dining_area_id = ? AND table_number = ? LIMIT 1`,
      [areaId, tableNumber],
    );
  if (rows.length > 0) throw new AppError(409, 'A table with this name already exists in the selected area');
}

export async function listRestaurantTables(branchId: string, userId: string) {
  await assertOwnedBranch(branchId, userId);
  const [rows] = await pool.query<RestaurantTableRow[]>(
    `SELECT t.id,
            r.id AS restaurantId,
            t.dining_area_id AS areaId,
            da.name AS areaName,
            t.table_number AS tableNumber,
            t.capacity,
            t.status,
            t.created_at AS createdAt,
            t.updated_at AS updatedAt
       FROM restaurant_tables t
       JOIN dining_areas da ON da.id = t.dining_area_id
       JOIN branches b ON b.id = da.branch_id
       JOIN restaurants r ON r.id = b.restaurant_id
      WHERE b.id = ? AND r.owner_user_id = ?
      ORDER BY da.sort_order ASC, da.name ASC, t.table_number ASC`,
    [branchId, userId],
  );
  return rows;
}

export async function createRestaurantTable(
  branchId: string,
  userId: string,
  input: { areaId: string; tableNumber: string; capacity: number },
) {
  await assertOwnedBranch(branchId, userId);
  await assertActiveDiningArea(branchId, input.areaId);
  await assertUniqueTableNumber(input.areaId, input.tableNumber);

  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO restaurant_tables (id, dining_area_id, table_number, capacity)
     VALUES (?, ?, ?, ?)`,
    [id, input.areaId, input.tableNumber, input.capacity],
  );

  const created = await listRestaurantTables(branchId, userId);
  return created.find((table) => table.id === id)!;
}

export async function updateRestaurantTable(
  branchId: string,
  tableId: string,
  userId: string,
  input: {
    areaId?: string;
    tableNumber?: string;
    capacity?: number;
    status?: 'available' | 'occupied' | 'reserved' | 'out_of_service';
  },
) {
  await assertOwnedBranch(branchId, userId);
  const [existingRows] = await pool.query<RowDataPacket[]>(
    `SELECT t.dining_area_id AS areaId
       FROM restaurant_tables t
       JOIN dining_areas da ON da.id = t.dining_area_id
      WHERE t.id = ? AND da.branch_id = ?
      LIMIT 1`,
    [tableId, branchId],
  );
  if (existingRows.length === 0) throw new AppError(404, 'Table not found');

  const existingAreaId = existingRows[0].areaId as string;
  const areaId = input.areaId ?? existingAreaId;
  if (input.areaId !== undefined && areaId !== existingAreaId) {
    await assertActiveDiningArea(branchId, areaId);
  }
  if (input.tableNumber !== undefined) {
    await assertUniqueTableNumber(areaId, input.tableNumber, tableId);
  }

  const assignments: string[] = [];
  const values: Array<string | number> = [];
  if (input.areaId !== undefined) {
    assignments.push('dining_area_id = ?');
    values.push(input.areaId);
  }
  if (input.tableNumber !== undefined) {
    assignments.push('table_number = ?');
    values.push(input.tableNumber);
  }
  if (input.capacity !== undefined) {
    assignments.push('capacity = ?');
    values.push(input.capacity);
  }
  if (input.status !== undefined) {
    assignments.push('status = ?');
    values.push(input.status);
  }
  values.push(tableId);
  await pool.query<ResultSetHeader>(
    `UPDATE restaurant_tables SET ${assignments.join(', ')} WHERE id = ?`,
    values,
  );

  const updated = await listRestaurantTables(branchId, userId);
  return updated.find((table) => table.id === tableId)!;
}

export async function deleteRestaurantTable(branchId: string, tableId: string, userId: string) {
  await assertOwnedBranch(branchId, userId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.id
       FROM restaurant_tables t
       JOIN dining_areas da ON da.id = t.dining_area_id
      WHERE t.id = ? AND da.branch_id = ?
      LIMIT 1`,
    [tableId, branchId],
  );
  if (rows.length === 0) throw new AppError(404, 'Table not found');
  await pool.query('DELETE FROM restaurant_tables WHERE id = ?', [tableId]);
}
