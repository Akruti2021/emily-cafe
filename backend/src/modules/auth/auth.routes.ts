import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  signupSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schemas';
import * as svc from './auth.service';

export const authRouter = Router();

const COOKIE = 'refreshToken';
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
};

const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: env.REFRESH_DAYS * 24 * 60 * 60 * 1000 });

const clearRefreshCookie = (res: Response) => res.clearCookie(COOKIE, cookieOptions);

const limiter = (minutes: number, max: number) =>
  rateLimit({
    windowMs: minutes * 60 * 1000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  });

authRouter.post('/signup', limiter(60, 20), validate(signupSchema), asyncHandler(async (req, res) => {
  const r = await svc.signup(req.body);
  setRefreshCookie(res, r.refreshToken);
  res.status(201).json({ accessToken: r.accessToken, user: r.user });
}));

authRouter.post('/login', limiter(15, 30), validate(loginSchema), asyncHandler(async (req, res) => {
  const r = await svc.login(req.body.email, req.body.password);
  setRefreshCookie(res, r.refreshToken);
  res.json({ accessToken: r.accessToken, user: r.user });
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  try {
    const r = await svc.refresh(req.cookies?.[COOKIE]);
    setRefreshCookie(res, r.refreshToken);
    res.json({ accessToken: r.accessToken, user: r.user });
  } catch (e) {
    clearRefreshCookie(res);
    throw e;
  }
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  await svc.logout(req.cookies?.[COOKIE]);
  clearRefreshCookie(res);
  res.json({ ok: true });
}));

authRouter.post('/logout-all', requireAuth, asyncHandler(async (req, res) => {
  await svc.logoutAll(req.user!.id);
  clearRefreshCookie(res);
  res.json({ ok: true });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json(await svc.me(req.user!.id));
}));

authRouter.post('/change-password', requireAuth, validate(changePasswordSchema), asyncHandler(async (req, res) => {
  const r = await svc.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  setRefreshCookie(res, r.refreshToken);
  res.json({ accessToken: r.accessToken, user: r.user });
}));

authRouter.post('/forgot-password', limiter(60, 10), validate(forgotPasswordSchema), asyncHandler(async (req, res) => {
  await svc.forgotPassword(req.body.email);
  res.json({ message: 'If that email is registered, a reset link has been sent.' });
}));

authRouter.post('/reset-password', limiter(60, 20), validate(resetPasswordSchema), asyncHandler(async (req, res) => {
  await svc.resetPassword(req.body.token, req.body.newPassword);
  res.json({ message: 'Password updated. Please log in with your new password.' });
}));