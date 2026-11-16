import { api as apiClient } from './client';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'RAZORPAY';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
export type DiscountType = 'NONE' | 'PERCENTAGE' | 'FLAT';

export interface SplitPaymentInput {
  paymentMethod: PaymentMethod;
  amount: number;
  tenderedAmount?: number;
  referenceNumber?: string;
  notes?: string;
}

export interface BillingOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountTotal: number;
  serviceChargeRate: number;
  serviceChargeTotal: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
}

export interface BillingLineItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  taxRate: number;
}

export interface TaxBreakdownItem {
  taxName: string;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface OrderPaymentRecord {
  id: string;
  paymentMethod: PaymentMethod;
  amount: number;
  tenderedAmount: number | null;
  changeReturned: number;
  referenceNumber: string | null;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  recordedByName: string;
}

export interface PaymentRefundRecord {
  id: string;
  paymentId: string;
  refundMethod: 'CASH' | 'CARD' | 'UPI';
  amount: number;
  reason: string;
  referenceNumber: string | null;
  createdAt: string;
  refundedByName: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  gstin?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  invoiceSnapshot?: Record<string, unknown>;
  issuedAt: string;
}

export interface OrderBillingResponse {
  order: BillingOrderSummary;
  items: BillingLineItem[];
  taxBreakdowns: TaxBreakdownItem[];
  payments: OrderPaymentRecord[];
  refunds: PaymentRefundRecord[];
  invoice: InvoiceRecord | null;
}

export interface RazorpayCreateOrderResponse {
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

export async function getOrderBillingApi(orderId: string): Promise<OrderBillingResponse> {
  const { data } = await apiClient.get<OrderBillingResponse>(`/billing/orders/${orderId}`);
  return data;
}

export async function calculateOrderBillApi(
  orderId: string,
  payload: {
    discountType: DiscountType;
    discountValue: number;
    applyServiceCharge: boolean;
    applyRoundOff: boolean;
  },
): Promise<OrderBillingResponse> {
  const { data } = await apiClient.post<OrderBillingResponse>(
    `/billing/orders/${orderId}/calculate`,
    payload,
  );
  return data;
}

export async function recordOrderPaymentsApi(
  orderId: string,
  payload: {
    idempotencyKey: string;
    payments: Array<{
      paymentMethod: 'CASH' | 'CARD' | 'UPI';
      amount: number;
      tenderedAmount?: number;
      referenceNumber?: string;
      notes?: string;
    }>;
  },
): Promise<OrderBillingResponse> {
  const { data } = await apiClient.post<OrderBillingResponse>(
    `/billing/orders/${orderId}/payments`,
    payload,
  );
  return data;
}

export async function createRazorpayOrderApi(
  orderId: string,
  amount: number,
): Promise<RazorpayCreateOrderResponse> {
  const { data } = await apiClient.post<RazorpayCreateOrderResponse>(
    `/billing/orders/${orderId}/razorpay/create-order`,
    { amount },
  );
  return data;
}

export async function verifyRazorpayPaymentApi(
  orderId: string,
  payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    idempotencyKey: string;
  },
): Promise<OrderBillingResponse> {
  const { data } = await apiClient.post<OrderBillingResponse>(
    `/billing/orders/${orderId}/razorpay/verify`,
    payload,
  );
  return data;
}

export async function refundOrderPaymentApi(
  orderId: string,
  paymentId: string,
  payload: {
    idempotencyKey: string;
    refundMethod: 'CASH' | 'CARD' | 'UPI';
    amount: number;
    reason: string;
    referenceNumber?: string;
  },
): Promise<OrderBillingResponse> {
  const { data } = await apiClient.post<OrderBillingResponse>(
    `/billing/orders/${orderId}/payments/${paymentId}/refund`,
    payload,
  );
  return data;
}

export async function generateOrGetInvoiceApi(orderId: string): Promise<InvoiceRecord> {
  const { data } = await apiClient.post<InvoiceRecord>(`/billing/orders/${orderId}/invoice`);
  return data;
}

export const billingApi = {
  getOrderBilling: getOrderBillingApi,
  calculateBill: calculateOrderBillApi,
  recordPayments: (
    orderId: string,
    idempotencyKey: string,
    payments: Array<{
      paymentMethod: 'CASH' | 'CARD' | 'UPI';
      amount: number;
      tenderedAmount?: number;
      referenceNumber?: string;
      notes?: string;
    }>,
  ) => recordOrderPaymentsApi(orderId, { idempotencyKey, payments }),
  createRazorpayOrder: createRazorpayOrderApi,
  verifyRazorpayPayment: verifyRazorpayPaymentApi,
  refundPayment: refundOrderPaymentApi,
  generateInvoice: generateOrGetInvoiceApi,
};

export default billingApi;