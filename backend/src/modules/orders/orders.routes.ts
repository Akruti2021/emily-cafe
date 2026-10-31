import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import * as svc from './orders.service';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.get('/recent', asyncHandler(async (req, res) => {
  const rawBranchId = req.query.branchId;
  const branchId = typeof rawBranchId === 'string' ? rawBranchId : undefined;
  if (rawBranchId !== undefined && branchId === undefined) {
    return res.status(400).json({ error: 'Invalid branch ID' });
  }

  const parsed = z.string().uuid().optional().safeParse(branchId);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid branch ID' });
  }

  res.json(await svc.getRecentOrders(req.user!.id, parsed.data));
}));