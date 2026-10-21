import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email');
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerRestaurantOnboardingSchema = z.object({
  restaurantName: z.string().trim().min(2, 'Restaurant name must be at least 2 characters').max(160),
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email,
  phone: z.string().trim().optional(),
  password,
});

export const createBranchSchema = z.object({
  restaurantId: z.string().uuid('Invalid restaurant ID'),
  code: z.string().trim().min(2, 'Branch code must be at least 2 characters').max(40),
  name: z.string().trim().min(2, 'Branch name must be at least 2 characters').max(160),
  address: z.string().trim().optional(),
});