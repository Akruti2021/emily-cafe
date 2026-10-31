import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import * as svc from './dashboard.service';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/stats', asyncHandler(async (req, res) => {
  res.json(await svc.getStats(req.user!.id));
}));
