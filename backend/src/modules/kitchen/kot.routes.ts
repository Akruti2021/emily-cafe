import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { createKotSchema, listKotsSchema, updateKotItemStatusSchema } from './kot.schemas';
import * as svc from './kot.service';

export const kotRouter = Router();
kotRouter.use(requireAuth);

kotRouter.get('/', asyncHandler(async (req, res) => {
  const parsed = listKotsSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid branch ID' });
  res.json(await svc.listKots(req.user!.id, parsed.data.branchId));
}));

kotRouter.post('/orders/:orderId', asyncHandler(async (req, res) => {
  const parsedOrderId = z.string().uuid().safeParse(req.params.orderId);
  const parsedBody = createKotSchema.safeParse({ ...req.body, orderId: req.params.orderId });
  if (!parsedOrderId.success || !parsedBody.success) {
    return res.status(400).json({ error: parsedBody.success ? 'Invalid order ID' : parsedBody.error.issues[0]?.message ?? 'Invalid KOT request' });
  }
  const result = await svc.createKot(req.user!.id, parsedOrderId.data, parsedBody.data.instructions);
  res.status(201).json(result);
}));

kotRouter.patch('/items/:itemId/status', asyncHandler(async (req, res) => {
  const parsedId = z.string().uuid().safeParse(req.params.itemId);
  const parsedBody = updateKotItemStatusSchema.safeParse(req.body);
  if (!parsedId.success || !parsedBody.success) {
    return res.status(400).json({ error: parsedBody.success ? 'Invalid KOT item ID' : parsedBody.error.issues[0]?.message ?? 'Invalid status' });
  }
  res.json(await svc.updateKotItemStatus(req.user!.id, parsedId.data, parsedBody.data.status));
}));
