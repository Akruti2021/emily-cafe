import argon2 from 'argon2';
import crypto from 'crypto';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorhandler';
import { sendMail } from '../../utils/mailer';
import { randomToken, sha256, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/tokens';

const RESET_MINUTES = 30;
type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  isActive: boolean;
};
const toPublic = (u: User) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

const revokeAllSessions = (userId: string) =>
  prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

async function issueSession(user: User) {
  const jti = crypto.randomUUID();
  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId: user.id,
      expiresAt: new Date(Date.now() + env.REFRESH_DAYS * 864e5),
    },
  });

  return {
    accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    refreshToken: signRefreshToken({ sub: user.id, jti }),
    user: toPublic(user),
  };
}

export async function signup(input: { name: string; email: string; password: string }) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw new AppError(409, 'This email is already registered');

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await argon2.hash(input.password),
    },
  });

  return issueSession(user);
}

export async function login(email: string, password: string) {
  const invalid = new AppError(401, 'Invalid email or password');
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await argon2.hash(password);
    throw invalid;
  }
  if (!user.isActive) throw invalid;
  if (!(await argon2.verify(user.passwordHash, password))) throw invalid;

  return issueSession(user);
}

export async function refresh(token: string | undefined) {
  if (!token) throw new AppError(401, 'No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const row = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!row || row.userId !== payload.sub) throw new AppError(401, 'Invalid refresh token');
  if (row.expiresAt < new Date()) throw new AppError(401, 'Session expired. Please log in again.');

  const claimed = await prisma.refreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (claimed.count === 0) {
    await revokeAllSessions(row.userId);
    throw new AppError(401, 'Session is no longer valid. Please log in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user || !user.isActive) throw new AppError(401, 'Account is not available');

  return issueSession(user);
}

export async function logout(token: string | undefined) {
  if (!token) return;
  try {
    const { jti } = verifyRefreshToken(token);
    await prisma.refreshToken.updateMany({
      where: { id: jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {}
}

export const logoutAll = (userId: string) => revokeAllSessions(userId);

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new AppError(401, 'Account is not available');
  return toPublic(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!(await argon2.verify(user.passwordHash, currentPassword))) {
    throw new AppError(400, 'Current password is incorrect');
  }
  if (currentPassword === newPassword) {
    throw new AppError(400, 'New password must be different from the current one');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await argon2.hash(newPassword) },
  });

  await revokeAllSessions(userId);
  return issueSession(updated);
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return;

  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomToken();
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000),
    },
  });

  await sendMail(
    user.email,
    'Reset your password',
    `Hello ${user.name},\n\nSet a new password here (valid for ${RESET_MINUTES} minutes):\n${env.CLIENT_URL}/reset-password?token=${token}\n\nIf you did not request this, ignore this email.`,
  );
}

export async function resetPassword(token: string, newPassword: string) {
  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new AppError(400, 'This reset link is invalid or has expired');
  }

  const passwordHash = await argon2.hash(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}