import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { calculateBillSchema, recordPaymentsSchema, refundPaymentSchema } from './billing.schemas';
import * as billingSvc from './billing.service';

export const billingRouter = Router();

billingRouter.use(requireAuth);

billingRouter.get(
  '/orders/:orderId',
  asyncHandler(async (req, res) => {
    const orderId = z.string().uuid().safeParse(req.params.orderId);
    if (!orderId.success) return res.status(400).json({ error: 'Invalid order ID' });
    res.json(await billingSvc.getOrderBilling(req.user!.id, orderId.data));
  }),
);

billingRouter.post(
  '/orders/:orderId/calculate',
  validate(calculateBillSchema),
  asyncHandler(async (req, res) => {
    const orderId = z.string().uuid().safeParse(req.params.orderId);
    if (!orderId.success) return res.status(400).json({ error: 'Invalid order ID' });
    res.json(await billingSvc.calculateOrderBill(req.user!.id, orderId.data, req.body));
  }),
);

billingRouter.post(
  '/orders/:orderId/payments',
  validate(recordPaymentsSchema),
  asyncHandler(async (req, res) => {
    const orderId = z.string().uuid().safeParse(req.params.orderId);
    if (!orderId.success) return res.status(400).json({ error: 'Invalid order ID' });
    res.status(201).json(await billingSvc.recordOrderPayments(req.user!.id, orderId.data, req.body));
  }),
);

billingRouter.post(
  '/orders/:orderId/payments/:paymentId/refund',
  validate(refundPaymentSchema),
  asyncHandler(async (req, res) => {
    const orderId = z.string().uuid().safeParse(req.params.orderId);
    const paymentId = z.string().uuid().safeParse(req.params.paymentId);
    if (!orderId.success || !paymentId.success) {
      return res.status(400).json({ error: 'Invalid order or payment ID' });
    }
    res.status(201).json(
      await billingSvc.refundOrderPayment(req.user!.id, orderId.data, paymentId.data, req.body),
    );
  }),
);

billingRouter.post(
  '/orders/:orderId/invoice',
  asyncHandler(async (req, res) => {
    const orderId = z.string().uuid().safeParse(req.params.orderId);
    if (!orderId.success) return res.status(400).json({ error: 'Invalid order ID' });
    res.status(201).json(await billingSvc.generateOrGetInvoice(req.user!.id, orderId.data));
  }),
);