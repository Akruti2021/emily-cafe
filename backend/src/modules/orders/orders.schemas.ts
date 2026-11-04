import { z } from 'zod';

export const createPosDineInOrderSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  tableId: z.string().uuid('Invalid table ID'),
  items: z.array(z.object({
    menuItemId: z.string().uuid('Invalid menu item ID'),
    quantity: z.number().int().min(1).max(20),
  })).min(1, 'Add at least one item').max(40, 'An order can contain up to 40 items'),
});

export const createDineInOrderSchema = z.object({
  restaurantId: z.string().uuid('Invalid restaurant ID'),
  tableId: z.string().uuid('Invalid table ID'),
  items: z.array(z.object({
    menuItemId: z.string().uuid('Invalid menu item ID'),
    quantity: z.number().int().min(1).max(20),
  })).min(1, 'Add at least one item').max(40, 'An order can contain up to 40 items'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
});
