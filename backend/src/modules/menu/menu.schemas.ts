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

export const itemOptionsSchema = z.object({
  variants: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(120), priceDelta: z.number().finite().min(-999999).max(999999), status: z.enum(['active', 'inactive']).default('active'), sortOrder: z.number().int().min(0).default(0) })).max(50),
  addonGroups: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(120), minSelections: z.number().int().min(0).max(50), maxSelections: z.number().int().min(0).max(50), status: z.enum(['active', 'inactive']).default('active'), sortOrder: z.number().int().min(0).default(0), addons: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(120), priceDelta: z.number().finite().min(0).max(999999), status: z.enum(['active', 'inactive']).default('active'), sortOrder: z.number().int().min(0).default(0) })).max(50) }).refine((g) => g.minSelections <= g.maxSelections && g.maxSelections <= g.addons.length, { message: 'Selection limits must fit the available add-ons' })).max(30),
});
