import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid input', details: err.issues });
  }
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'Duplicate record' });
  }
  const status = err.status ?? 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
}