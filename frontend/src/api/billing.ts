import { api } from './client';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI';

export interface SplitPaymentInput {
  paymentMethod: PaymentMethod;
  amount: number;
  tenderedAmount?: number;
  referenceNumber?: string;
  notes?: string;
}

export const billingApi = {
  getOrderBilling: (orderId: string) => api.get(`/billing/orders/${orderId}`).then((r) => r.data),
  calculateBill: (
    orderId: string,
    payload: {
      discountType: 'NONE' | 'PERCENTAGE' | 'FLAT';
      discountValue: number;
      applyServiceCharge: boolean;
      applyRoundOff: boolean;
    },
  ) => api.post(`/billing/orders/${orderId}/calculate`, payload).then((r) => r.data),
  recordPayments: (orderId: string, idempotencyKey: string, payments: SplitPaymentInput[]) =>
    api.post(`/billing/orders/${orderId}/payments`, { idempotencyKey, payments }).then((r) => r.data),
  refundPayment: (
    orderId: string,
    paymentId: string,
    payload: {
      idempotencyKey: string;
      refundMethod: PaymentMethod;
      amount: number;
      reason: string;
      referenceNumber?: string;
    },
  ) => api.post(`/billing/orders/${orderId}/payments/${paymentId}/refund`, payload).then((r) => r.data),
  generateInvoice: (orderId: string) => api.post(`/billing/orders/${orderId}/invoice`).then((r) => r.data),
};