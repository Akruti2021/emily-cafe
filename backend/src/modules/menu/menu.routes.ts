
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import * as svc from './menu.service';
import {
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from './menu.schemas';

export const menuRouter = Router();

const restaurantIdSchema = z.string().uuid();
const resourceIdSchema = z.string().uuid();

menuRouter.get('/:restaurantId', asyncHandler(async (req, res) => {
  const parsed = restaurantIdSchema.safeParse(req.params.restaurantId);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid restaurant ID' });
  }

  res.json({ categories: await svc.getMenu(parsed.data) });
}));

menuRouter.use(requireAuth);

menuRouter.get(
  '/:restaurantId/manage',
  asyncHandler(async (req, res) => {
    const restaurant = restaurantIdSchema.safeParse(req.params.restaurantId);
    if (!restaurant.success) {
      return res.status(400).json({ error: 'Invalid restaurant ID' });
    }

    res.json({
      categories: await svc.getManagementMenu(restaurant.data, req.user!.id),
    });
  }),
);

menuRouter.post(
  '/:restaurantId/categories',
  validate(createCategorySchema),
  asyncHandler(async (req, res) => {
    const restaurant = restaurantIdSchema.safeParse(req.params.restaurantId);
    if (!restaurant.success) {
      return res.status(400).json({ error: 'Invalid restaurant ID' });
    }

    const category = await svc.createCategory(
      restaurant.data,
      req.user!.id,
      req.body,
    );
    res.status(201).json(category);
  }),
);

menuRouter.patch(
  '/:restaurantId/categories/:categoryId',
  validate(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const restaurant = restaurantIdSchema.safeParse(req.params.restaurantId);
    const category = resourceIdSchema.safeParse(req.params.categoryId);

    if (!restaurant.success || !category.success) {
      return res.status(400).json({ error: 'Invalid restaurant or category ID' });
    }

    const result = await svc.updateCategory(
      restaurant.data,
      category.data,
      req.user!.id,
      req.body,
    );
    res.json(result);
  }),
);

menuRouter.post(
  '/:restaurantId/items',
  validate(createMenuItemSchema),
  asyncHandler(async (req, res) => {
    const restaurant = restaurantIdSchema.safeParse(req.params.restaurantId);
    if (!restaurant.success) {
      return res.status(400).json({ error: 'Invalid restaurant ID' });
    }

    const item = await svc.createMenuItem(
      restaurant.data,
      req.user!.id,
      req.body,
    );
    res.status(201).json(item);
  }),
);

menuRouter.patch(
  '/:restaurantId/items/:itemId',
  validate(updateMenuItemSchema),
  asyncHandler(async (req, res) => {
    const restaurant = restaurantIdSchema.safeParse(req.params.restaurantId);
    const item = resourceIdSchema.safeParse(req.params.itemId);

    if (!restaurant.success || !item.success) {
      return res.status(400).json({ error: 'Invalid restaurant or item ID' });
    }

    const result = await svc.updateMenuItem(
      restaurant.data,
      item.data,
      req.user!.id,
      req.body,
    );
    res.json(result);
  }),
);
