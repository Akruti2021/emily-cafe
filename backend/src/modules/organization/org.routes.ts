import { Router, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  registerRestaurantOnboardingSchema,
  createBranchSchema,
  createBranchMemberSchema,
  updateBranchMemberSchema,
} from './org.schemas';
import * as svc from './org.service';

export const orgRouter = Router();

const COOKIE = 'refreshToken';
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
};

const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: env.REFRESH_DAYS * 24 * 60 * 60 * 1000 });

// Public Onboarding: /api/org/onboard
orgRouter.post(
  '/onboard',
  validate(registerRestaurantOnboardingSchema),
  asyncHandler(async (req, res) => {
    const result = await svc.registerRestaurantOnboarding(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({
      accessToken: result.accessToken,
      user: result.user,
      restaurant: result.restaurant,
    });
  }),
);

// Protected routes
orgRouter.use(requireAuth);

orgRouter.get(
  '/branches/accessible',
  asyncHandler(async (req, res) => {
    res.json(await svc.listAccessibleBranches(req.user!.id));
  }),
);

orgRouter.get('/branches/:branchId/members', asyncHandler(async (req, res) => {
  const branchId = z.string().uuid().safeParse(req.params.branchId);
  if (!branchId.success) return res.status(400).json({ error: 'Invalid branch ID' });
  res.json({ members: await svc.listBranchMembers(req.user!.id, branchId.data) });
}));

orgRouter.post(
  '/branches/:branchId/members',
  validate(createBranchMemberSchema),
  asyncHandler(async (req, res) => {
    const branchId = z.string().uuid().safeParse(req.params.branchId);
    if (!branchId.success) return res.status(400).json({ error: 'Invalid branch ID' });
    res.status(201).json(await svc.addBranchMember(req.user!.id, branchId.data, req.body));
  }),
);

orgRouter.patch(
  '/branches/:branchId/members/:memberId',
  validate(updateBranchMemberSchema),
  asyncHandler(async (req, res) => {
    const branchId = z.string().uuid().safeParse(req.params.branchId);
    const memberId = z.string().uuid().safeParse(req.params.memberId);
    if (!branchId.success || !memberId.success) return res.status(400).json({ error: 'Invalid branch or user ID' });
    res.json(await svc.updateBranchMemberRole(req.user!.id, branchId.data, memberId.data, req.body.role));
  }),
);

orgRouter.delete('/branches/:branchId/members/:memberId', asyncHandler(async (req, res) => {
  const branchId = z.string().uuid().safeParse(req.params.branchId);
  const memberId = z.string().uuid().safeParse(req.params.memberId);
  if (!branchId.success || !memberId.success) return res.status(400).json({ error: 'Invalid branch or user ID' });
  await svc.removeBranchMember(req.user!.id, branchId.data, memberId.data);
  res.status(204).send();
}));

orgRouter.get(
  '/restaurants',
  asyncHandler(async (req, res) => {
    const list = await svc.getUserRestaurants(req.user!.id);
    res.json(list);
  }),
);

orgRouter.post(
  '/branches',
  validate(createBranchSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.createBranch(req.user!.id, req.body);
    res.status(201).json(r);
  }),
);