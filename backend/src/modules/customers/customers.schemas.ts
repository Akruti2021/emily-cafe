import { z } from 'zod';

const contact = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(32).optional().nullable(),
  email: z.string().trim().email().max(191).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const listCustomersSchema = z.object({
  branchId: z.string().uuid(),
  q: z.string().trim().max(100).optional(),
});

export const createCustomerSchema = contact.extend({ branchId: z.string().uuid() });
export const updateCustomerSchema = contact.extend({ branchId: z.string().uuid() });
export const customerIdSchema = z.string().uuid();
