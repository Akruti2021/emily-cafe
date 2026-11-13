import { z } from 'zod';

export const calculateBillSchema = z.object({
  discountType: z.enum(['NONE', 'PERCENTAGE', 'FLAT']).default('NONE'),
  discountValue: z.number().min(0).max(100000).default(0),
  applyServiceCharge: z.boolean().default(true),
  applyRoundOff: z.boolean().default(true),
});

const singlePaymentEntrySchema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI']),
  amount: z.number().positive('Payment amount must be greater than 0').max(1000000),
  tenderedAmount: z.number().positive().max(1000000).optional(),
  // Block raw 13-19 digit card numbers; allow only UTR / approval codes
  referenceNumber: z
    .string()
    .trim()
    .max(100)
    .refine((val) => !/^\d{13,19}$/.test(val.replace(/[\s-]/g, '')), {
      message: 'Do not enter raw card numbers; enter approval code or UTR only',
    })
    .optional(),
  notes: z.string().trim().max(255).optional(),
});

export const recordPaymentsSchema = z.object({
  idempotencyKey: z.string().uuid('Valid UUID idempotencyKey is required'),
  payments: z.array(singlePaymentEntrySchema).min(1, 'Provide at least one payment').max(10),
});

export const refundPaymentSchema = z.object({
  idempotencyKey: z.string().uuid('Valid UUID idempotencyKey is required'),
  refundMethod: z.enum(['CASH', 'CARD', 'UPI']),
  amount: z.number().positive('Refund amount must be greater than 0'),
  reason: z.string().trim().min(3, 'Refund reason is required').max(500),
  referenceNumber: z.string().trim().max(100).optional(),
});