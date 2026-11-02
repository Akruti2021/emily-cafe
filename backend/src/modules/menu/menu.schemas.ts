import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided',
});

export const createMenuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(5000).nullable().optional(),
  basePrice: z.number().finite().min(0).max(9999999999.99),
  taxRate: z.number().finite().min(0).max(100).optional(),
});

export const updateMenuItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  basePrice: z.number().finite().min(0).max(9999999999.99).optional(),
  taxRate: z.number().finite().min(0).max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided',
});
