import { z } from 'zod';

const areaName = z.string().trim().min(2, 'Area name must be at least 2 characters').max(100);
const areaDescription = z.string().trim().max(255, 'Description must be 255 characters or fewer').nullable().optional();

export const createDiningAreaSchema = z.object({
  name: areaName,
  description: areaDescription,
});

export const updateDiningAreaSchema = z.object({
  name: areaName.optional(),
  description: areaDescription,
  status: z.enum(['active', 'inactive']).optional(),
}).refine((input) => Object.values(input).some((value) => value !== undefined), {
  message: 'Provide at least one field to update',
});

export const tableStatusSchema = z.enum(['available', 'occupied', 'reserved', 'out_of_service']);

export const createRestaurantTableSchema = z.object({
  areaId: z.string().uuid('Invalid dining area ID'),
  tableNumber: z.string().trim().min(1, 'Table name is required').max(40),
  capacity: z.number().int().min(1).max(50),
});

export const updateRestaurantTableSchema = z.object({
  areaId: z.string().uuid('Invalid dining area ID').optional(),
  tableNumber: z.string().trim().min(1, 'Table name is required').max(40).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  status: tableStatusSchema.optional(),
}).refine((input) => Object.values(input).some((value) => value !== undefined), {
  message: 'Provide at least one field to update',
});
