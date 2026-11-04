import { z } from 'zod';

export const listKotsSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
});

export const createKotSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  instructions: z.record(z.string().uuid(), z.string().trim().max(500)).optional().default({}),
});

export const updateKotItemStatusSchema = z.object({
  status: z.enum(['Accepted', 'Preparing', 'Ready', 'Completed', 'Cancelled']),
});
