import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createDineInOrderSchema, updateOrderStatusSchema } from './orders.schemas';
import * as svc from './orders.service';
import { rateLimit } from 'express-rate-limit';

export const ordersRouter = Router();

const dineInOrderLimiter = rateLimit({ windowMs: 60_000, max: 8, standardHeaders: true, legacyHeaders: false });

ordersRouter.post(
  '/dine-in',
  dineInOrderLimiter,
  validate(createDineInOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await svc.createDineInOrder(req.body);
    res.status(201).json(order);
  }),
);

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

ordersRouter.get('/history', asyncHandler(async (req, res) => {
  const querySchema = z.object({
    branchId: z.string().uuid().optional(),
    status: z.enum(['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
  });
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid order history filters' });

  res.json(await svc.getOrderHistory(req.user!.id, parsed.data));
}));

ordersRouter.patch(
  '/:orderId/status',
  validate(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const orderId = z.string().uuid().safeParse(req.params.orderId);
    if (!orderId.success) return res.status(400).json({ error: 'Invalid order ID' });

    res.json(await svc.updateOrderStatus(req.user!.id, orderId.data, req.body.status));
  }),
);
