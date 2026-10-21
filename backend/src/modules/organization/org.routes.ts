import { Router, Response } from 'express';
import { env } from '../../config/env';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  registerRestaurantOnboardingSchema,
  createBranchSchema,
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