import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import * as svc from './menu.service';

export const menuRouter = Router();

const restaurantIdSchema = z.string().uuid();

menuRouter.get('/:restaurantId', asyncHandler(async (req, res) => {
  const parsed = restaurantIdSchema.safeParse(req.params.restaurantId);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid restaurant ID' });
  }

  res.json({ categories: await svc.getMenu(parsed.data) });
}));
