import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/errorhandler';
import { authRouter } from './modules/auth/auth.routes';
import { orgRouter } from './modules/organization/org.routes';
import { menuRouter } from './modules/menu/menu.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';

export const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/org', orgRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/dashboard', dashboardRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);
