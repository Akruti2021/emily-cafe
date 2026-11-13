'use client';

import React, { useEffect, useState } from 'react';
import { billingApi, type PaymentMethod, type SplitPaymentInput } from '../../api/billing';

interface BillingCheckoutModalProps {
  orderId: string;
  userRole?: string; // e.g. 'OWNER' | 'BRANCH_MANAGER' | 'CASHIER'
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void; // callback to refresh parent order list
}

interface BillingState {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    subtotal: number;
    discountType: 'NONE' | 'PERCENTAGE' | 'FLAT';
    discountValue: number;
    discountTotal: number;
    serviceChargeRate: number;
    serviceChargeTotal: number;
    taxTotal: number;
    roundOff: number;
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
    paymentStatus: string;
  };
  items: Array<{ id: string; name: string; unitPrice: number; quantity: number; lineTotal: number }>;
  taxBreakdowns: Array<{ taxName: string; taxRate: number; taxAmount: number }>;
  payments: Array<{
    id: string;
    paymentMethod: PaymentMethod;
    amount: number;
    tenderedAmount: number | null;
    changeReturned: number;
    referenceNumber: string | null;
    status: string;
    createdAt: string;
    recordedByName: string;
  }>;
  refunds: Array<{
    id: string;
    paymentId: string;
    refundMethod: PaymentMethod;
    amount: number;
    reason: string;
    createdAt: string;
  }>;
  invoice: { id: string; invoiceNumber: string; issuedAt: string } | null;
}

export function BillingCheckoutModal({
  orderId,
  userRole = 'OWNER',
  isOpen,
  onClose,
  onUpdated,
}: BillingCheckoutModalProps) {
  const [data, setData] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Discount & Bill Controls
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENTAGE' | 'FLAT'>('NONE');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [applyServiceCharge, setApplyServiceCharge] = useState<boolean>(true);
  const [applyRoundOff, setApplyRoundOff] = useState<boolean>(true);

  // Payment Capture Controls
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'PARTIAL' | 'SPLIT'>('FULL');
  const [splitRows, setSplitRows] = useState<SplitPaymentInput[]>([
    { paymentMethod: 'CASH', amount: 0, tenderedAmount: undefined, referenceNumber: '' },
  ]);

  // Refund Controls
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('CASH');
  const [refundReason, setRefundReason] = useState<string>('');

  // Invoice Preview
  const [invoiceData, setInvoiceData] = useState<any | null>(null);

  const canRefund = userRole === 'OWNER' || userRole === 'BRANCH_MANAGER';

  const loadBilling = async () => {
    try {
      setLoading(true);
      setError(null);
      const res: BillingState = await billingApi.getOrderBilling(orderId);
      setData(res);
      setDiscountType(res.order.discountType);
      setDiscountValue(res.order.discountValue);
      setSplitRows([
        {
          paymentMethod: 'CASH',
          amount: res.order.balanceDue,
          tenderedAmount: undefined,
          referenceNumber: '',
        },
      ]);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load billing details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      loadBilling();
      setInvoiceData(null);
      setSuccessMsg(null);
    }
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const handleRecalculateBill = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const updated: BillingState = await billingApi.calculateBill(orderId, {
        discountType,
        discountValue: discountType === 'NONE' ? 0 : Number(discountValue),
        applyServiceCharge,
        applyRoundOff,
      });
      setData(updated);
      setSplitRows([{ paymentMethod: 'CASH', amount: updated.order.balanceDue }]);
      setSuccessMsg('Bill recalculated');
      onUpdated?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to calculate bill');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModeChange = (mode: 'FULL' | 'PARTIAL' | 'SPLIT') => {
    setPaymentMode(mode);
    const bal = data?.order.balanceDue ?? 0;
    if (mode === 'FULL') {
      setSplitRows([{ paymentMethod: 'CASH', amount: bal }]);
    } else if (mode === 'PARTIAL') {
      setSplitRows([{ paymentMethod: 'UPI', amount: 0 }]);
    } else {
      setSplitRows([
        { paymentMethod: 'CASH', amount: 0 },
        { paymentMethod: 'UPI', amount: 0 },
      ]);
    }
  };

  const updateSplitRow = (index: number, patch: Partial<SplitPaymentInput>) => {
    setSplitRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    const validPayments = splitRows
      .filter((r) => Number(r.amount) > 0)
      .map((r) => ({
        paymentMethod: r.paymentMethod,
        amount: Number(r.amount),
        tenderedAmount:
          r.paymentMethod === 'CASH' && r.tenderedAmount ? Number(r.tenderedAmount) : undefined,
        referenceNumber: r.referenceNumber?.trim() || undefined,
      }));

    if (validPayments.length === 0) {
      setError('Enter a payment amount greater than 0');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const idempotencyKey = crypto.randomUUID();
      const updated: BillingState = await billingApi.recordPayments(
        orderId,
        idempotencyKey,
        validPayments,
      );
      setData(updated);
      setSplitRows([{ paymentMethod: 'CASH', amount: updated.order.balanceDue }]);
      setSuccessMsg('Payment recorded successfully');
      onUpdated?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRefund = async (paymentId: string) => {
    try {
      setSubmitting(true);
      setError(null);
      const updated: BillingState = await billingApi.refundPayment(orderId, paymentId, {
        idempotencyKey: crypto.randomUUID(),
        refundMethod,
        amount: Number(refundAmount),
        reason: refundReason,
      });
      setData(updated);
      setRefundingPaymentId(null);
      setRefundReason('');
      setSuccessMsg('Refund issued');
      onUpdated?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Refund failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const inv = await billingApi.generateInvoice(orderId);
      setInvoiceData(inv);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not generate invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      {/* Print-only stylesheet so window.print() outputs only the GST Invoice */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-gst-invoice,
          #printable-gst-invoice * {
            visibility: visible;
          }
          #printable-gst-invoice {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
            padding: 16px;
          }
        }
      `}</style>

      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Checkout & Billing {data ? `— Order #${data.order.orderNumber}` : ''}
            </h2>
            {data && (
              <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Status: {data.order.paymentStatus}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Close ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {successMsg}
          </div>
        )}

        {loading || !data ? (
          <div className="py-12 text-center text-gray-500">Loading billing details...</div>
        ) : (
          <>
            {/* Main Two-Column Grid */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* LEFT PANEL: Bill Summary & Discount Controls */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 font-semibold text-gray-800">1. Bill Summary</h3>

                <div className="max-h-44 space-y-2 overflow-y-auto border-b pb-3 text-sm">
                  {data.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span className="font-medium">₹{item.lineTotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Discount Controls */}
                <div className="mt-3 space-y-2 border-b pb-3 text-sm">
                  <label className="block font-medium text-gray-700">Discount</label>
                  <div className="flex gap-2">
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as any)}
                      className="rounded border px-2 py-1.5"
                    >
                      <option value="NONE">None</option>
                      <option value="PERCENTAGE">% Percentage</option>
                      <option value="FLAT">₹ Flat Amount</option>
                    </select>
                    {discountType !== 'NONE' && (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        className="w-28 rounded border px-2 py-1.5"
                        placeholder="Value"
                      />
                    )}
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleRecalculateBill}
                      className="rounded bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      Apply / Recalculate
                    </button>
                  </div>
                </div>

                {/* Totals Breakdown */}
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>₹{data.order.subtotal.toFixed(2)}</span>
                  </div>
                  {data.order.discountTotal > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Discount</span>
                      <span>- ₹{data.order.discountTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {data.order.serviceChargeTotal > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Service Charge ({data.order.serviceChargeRate}%)</span>
                      <span>₹{data.order.serviceChargeTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {data.taxBreakdowns.map((t, idx) => (
                    <div key={idx} className="flex justify-between text-gray-600">
                      <span>
                        {t.taxName} ({t.taxRate}%)
                      </span>
                      <span>₹{t.taxAmount.toFixed(2)}</span>
                    </div>
                  ))}
                  {data.order.roundOff !== 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Round Off</span>
                      <span>
                        {data.order.roundOff > 0 ? '+' : ''}₹{data.order.roundOff.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-base font-bold text-gray-900">
                    <span>Grand Total</span>
                    <span>₹{data.order.grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>Amount Paid</span>
                    <span>₹{data.order.amountPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-red-600">
                    <span>Outstanding Balance</span>
                    <span>₹{data.order.balanceDue.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL: Payment Capture */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-3 font-semibold text-gray-800">2. Record Payment</h3>

                {data.order.balanceDue <= 0 ? (
                  <div className="rounded-lg bg-green-50 p-4 text-sm font-medium text-green-800">
                    This order is fully paid. Generate or print the GST invoice below.
                  </div>
                ) : (
                  <form onSubmit={handleRecordPayment} className="space-y-4">
                    {/* Payment Mode Toggle */}
                    <div className="flex gap-2">
                      {(['FULL', 'PARTIAL', 'SPLIT'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => handleModeChange(mode)}
                          className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold ${
                            paymentMode === mode
                              ? 'border-amber-600 bg-amber-600 text-white'
                              : 'border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          {mode === 'FULL'
                            ? 'Full Payment'
                            : mode === 'PARTIAL'
                            ? 'Partial'
                            : 'Split Payment'}
                        </button>
                      ))}
                    </div>

                    {/* Tender Rows */}
                    <div className="space-y-3">
                      {splitRows.map((row, index) => {
                        const changeToReturn =
                          row.paymentMethod === 'CASH' &&
                          row.tenderedAmount &&
                          row.tenderedAmount > row.amount
                            ? row.tenderedAmount - row.amount
                            : 0;

                        return (
                          <div key={index} className="rounded-lg border bg-gray-50 p-3 space-y-2">
                            <div className="flex gap-2">
                              <select
                                value={row.paymentMethod}
                                onChange={(e) =>
                                  updateSplitRow(index, {
                                    paymentMethod: e.target.value as PaymentMethod,
                                  })
                                }
                                className="rounded border bg-white px-2 py-1.5 text-sm font-medium"
                              >
                                <option value="CASH">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="CARD">Card</option>
                              </select>

                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={data.order.balanceDue}
                                value={row.amount || ''}
                                onChange={(e) =>
                                  updateSplitRow(index, { amount: Number(e.target.value) })
                                }
                                placeholder="Amount (₹)"
                                className="flex-1 rounded border bg-white px-2.5 py-1.5 text-sm"
                                required
                              />

                              {paymentMode === 'SPLIT' && splitRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSplitRows((prev) => prev.filter((_, i) => i !== index))
                                  }
                                  className="px-2 text-xs text-red-600 hover:underline"
                                >
                                  Remove
                                </button>
                              )}
                            </div>

                            {row.paymentMethod === 'CASH' ? (
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <input
                                  type="number"
                                  step="0.01"
                                  min={row.amount}
                                  value={row.tenderedAmount || ''}
                                  onChange={(e) =>
                                    updateSplitRow(index, {
                                      tenderedAmount: e.target.value
                                        ? Number(e.target.value)
                                        : undefined,
                                    })
                                  }
                                  placeholder="Cash Received (Optional)"
                                  className="w-48 rounded border bg-white px-2 py-1"
                                />
                                {changeToReturn > 0 && (
                                  <span className="font-semibold text-emerald-700">
                                    Change to Return: ₹{changeToReturn.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={row.referenceNumber || ''}
                                onChange={(e) =>
                                  updateSplitRow(index, { referenceNumber: e.target.value })
                                }
                                placeholder={
                                  row.paymentMethod === 'UPI'
                                    ? 'UPI UTR / Ref ID (Optional)'
                                    : 'Card Auth Code (No card numbers)'
                                }
                                className="w-full rounded border bg-white px-2 py-1 text-xs"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {paymentMode === 'SPLIT' && (
                      <button
                        type="button"
                        onClick={() =>
                          setSplitRows((prev) => [...prev, { paymentMethod: 'CARD', amount: 0 }])
                        }
                        className="text-xs font-semibold text-amber-700 hover:underline"
                      >
                        + Add Another Payment Method
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {submitting ? 'Processing Payment...' : 'Confirm & Record Payment'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* BOTTOM SECTION: Payment History, Refunds & Invoice */}
            <div className="mt-6 rounded-lg border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-800">3. Payment History & GST Invoice</h3>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleGenerateInvoice}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {data.invoice ? `View Invoice (${data.invoice.invoiceNumber})` : 'Generate GST Invoice'}
                </button>
              </div>

              {data.payments.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No payments recorded yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-gray-50 text-xs uppercase text-gray-600">
                      <tr>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Ref / Notes</th>
                        <th className="px-3 py-2">Recorded By</th>
                        <th className="px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.payments.map((p) => (
                        <React.Fragment key={p.id}>
                          <tr>
                            <td className="px-3 py-2 font-medium">{p.paymentMethod}</td>
                            <td className="px-3 py-2">₹{p.amount.toFixed(2)}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {p.referenceNumber || '—'}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">{p.recordedByName}</td>
                            <td className="px-3 py-2">
                              {canRefund && p.status === 'COMPLETED' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRefundingPaymentId(p.id);
                                    setRefundAmount(p.amount);
                                    setRefundMethod(p.paymentMethod);
                                  }}
                                  className="text-xs font-semibold text-red-600 hover:underline"
                                >
                                  Refund
                                </button>
                              )}
                            </td>
                          </tr>
                          {refundingPaymentId === p.id && (
                            <tr className="bg-red-50">
                              <td colSpan={5} className="p-3">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="font-semibold text-red-800">Issue Refund:</span>
                                  <select
                                    value={refundMethod}
                                    onChange={(e) =>
                                      setRefundMethod(e.target.value as PaymentMethod)
                                    }
                                    className="rounded border bg-white px-2 py-1"
                                  >
                                    <option value="CASH">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="CARD">Card</option>
                                  </select>
                                  <input
                                    type="number"
                                    step="0.01"
                                    max={p.amount}
                                    value={refundAmount}
                                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                                    className="w-24 rounded border bg-white px-2 py-1"
                                  />
                                  <input
                                    type="text"
                                    value={refundReason}
                                    onChange={(e) => setRefundReason(e.target.value)}
                                    placeholder="Reason for refund (required)"
                                    className="flex-1 rounded border bg-white px-2 py-1"
                                  />
                                  <button
                                    type="button"
                                    disabled={submitting || !refundReason.trim()}
                                    onClick={() => handleSubmitRefund(p.id)}
                                    className="rounded bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    Confirm Refund
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRefundingPaymentId(null)}
                                    className="px-2 text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Refund History */}
              {data.refunds.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <h4 className="text-xs font-semibold uppercase text-red-700">Refund History</h4>
                  <ul className="mt-1 space-y-1 text-xs text-gray-700">
                    {data.refunds.map((r) => (
                      <li key={r.id}>
                        Refunded <strong>₹{r.amount.toFixed(2)}</strong> via {r.refundMethod} —{' '}
                        <em>{r.reason}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Printable GST Invoice Preview */}
              {invoiceData && (
                <div
                  id="printable-gst-invoice"
                  className="mt-5 rounded-lg border-2 border-dashed border-gray-400 bg-white p-5 text-sm"
                >
                  <div className="flex items-start justify-between border-b pb-3">
                    <div>
                      <h4 className="text-lg font-bold">
                        {invoiceData.invoiceSnapshot.restaurantName}
                      </h4>
                      <p className="text-xs text-gray-600">
                        {invoiceData.invoiceSnapshot.branchName} —{' '}
                        {invoiceData.invoiceSnapshot.branchAddress}
                      </p>
                      {invoiceData.gstin && (
                        <p className="text-xs font-semibold">GSTIN: {invoiceData.gstin}</p>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-bold">TAX INVOICE</p>
                      <p>Invoice #: {invoiceData.invoiceNumber}</p>
                      <p>Order #: {invoiceData.invoiceSnapshot.orderNumber}</p>
                      {invoiceData.customerName && <p>Customer: {invoiceData.customerName}</p>}
                    </div>
                  </div>

                  <table className="mt-3 w-full text-xs">
                    <thead className="border-b">
                      <tr>
                        <th className="py-1 text-left">Item</th>
                        <th className="py-1 text-right">Qty</th>
                        <th className="py-1 text-right">Price</th>
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-1">{item.name}</td>
                          <td className="py-1 text-right">{item.quantity}</td>
                          <td className="py-1 text-right">₹{item.unitPrice.toFixed(2)}</td>
                          <td className="py-1 text-right">₹{item.lineTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-3 border-t pt-2 text-right text-xs space-y-1">
                    <p>Subtotal: ₹{data.order.subtotal.toFixed(2)}</p>
                    {data.order.discountTotal > 0 && (
                      <p>Discount: -₹{data.order.discountTotal.toFixed(2)}</p>
                    )}
                    <p>Total GST: ₹{data.order.taxTotal.toFixed(2)}</p>
                    <p className="text-sm font-bold">
                      Grand Total: ₹{data.order.grandTotal.toFixed(2)}
                    </p>
                    <p>
                      Paid: ₹{data.order.amountPaid.toFixed(2)} | Status:{' '}
                      {data.order.paymentStatus}
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end print:hidden">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="rounded bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                    >
                      Print / Save as PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}