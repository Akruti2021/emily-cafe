'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LoaderCircle, Receipt } from 'lucide-react';
import { useAuth } from '../../../src/auth/AuthContext';
import { api, getErrorMessage } from '../../../src/api/client';
import { BillingCheckoutModal } from '../../../src/components/billing/BillingCheckoutModel';

type Branch = { id: string; restaurantId: string; name: string; code: string; role: string };
type OrderRow = {
  id: string;
  orderNumber: string;
  tableNumber: string | null;
  title: string;
  status: string;
  grandTotal: number;
  createdAt: string;
};

const money = (value: number | string) => '₹' + Number(value).toFixed(2);

export default function BillingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [billingOrderId, setBillingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    api
      .get<Branch[]>('/org/branches/accessible')
      .then(({ data }) => {
        if (!active) return;
        const eligible = data.filter((b) =>
          ['OWNER', 'BRANCH_MANAGER', 'CASHIER', 'WAITER', 'ACCOUNTANT'].includes(b.role),
        );
        setBranches(eligible);
        const saved = window.localStorage.getItem('active_branch_id');
        const selected = eligible.find((b) => b.id === saved) ?? eligible[0];
        if (selected) setBranchId(selected.id);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const activeBranch = branches.find((b) => b.id === branchId);

  const loadOrders = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<{ items: OrderRow[] }>('/orders/history', {
        params: { branchId, limit: 50, offset: 0 },
      });
      setOrders(data.items ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf7f2] text-sm text-[#817a74]">
        <LoaderCircle className="mr-2 animate-spin" size={17} /> Loading Billing...
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#faf7f2] px-5 py-8 text-[#302a26] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#817a74] hover:text-[#2563eb]"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#2563eb]">
              Billing & Payments
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Invoices & Settlements</h1>
            <p className="mt-1 text-sm text-[#817a74]">
              Collect full, partial, or split payments, issue refunds, and print GST invoices.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/pos"
              className="rounded-xl border border-[#e8e2da] bg-white px-4 py-2.5 text-sm font-medium text-[#514942] hover:bg-[#fffdfa]"
            >
              + New POS Order
            </Link>
            {branches.length > 1 && (
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  window.localStorage.setItem('active_branch_id', e.target.value);
                }}
                className="rounded-xl border border-[#e8e2da] bg-white px-3 py-2.5 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>

        {error && (
          <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <section className="rounded-2xl border border-[#e8e2da] bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Receipt className="text-[#2563eb]" size={18} />
            <h2 className="font-semibold">Branch Orders</h2>
          </div>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-[#817a74]">
              <LoaderCircle size={17} className="mr-2 animate-spin" /> Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <p className="rounded-xl bg-stone-50 p-6 text-center text-sm text-[#817a74]">
              No orders found for this branch yet. Create one in POS to start billing.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#eee8df] text-xs uppercase text-[#817a74]">
                  <tr>
                    <th className="py-3 pr-4">Order #</th>
                    <th className="py-3 pr-4">Table</th>
                    <th className="py-3 pr-4">Items</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4 text-right">Total</th>
                    <th className="py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee8df]">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="py-3.5 pr-4 font-semibold">{order.orderNumber}</td>
                      <td className="py-3.5 pr-4 text-[#514942]">
                        {order.tableNumber ? `Table ${order.tableNumber}` : '—'}
                      </td>
                      <td className="max-w-xs truncate py-3.5 pr-4 text-[#817a74]">
                        {order.title}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-[#514942]">
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-semibold tabular-nums">
                        {money(order.grandTotal)}
                      </td>
                      <td className="py-3.5 text-right">
                        {order.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => setBillingOrderId(order.id)}
                            className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
                          >
                            Bill / Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {billingOrderId && (
        <BillingCheckoutModal
          orderId={billingOrderId}
          userRole={activeBranch?.role}
          isOpen={Boolean(billingOrderId)}
          onClose={() => setBillingOrderId(null)}
          onUpdated={() => {
            void loadOrders();
          }}
        />
      )}
    </main>
  );
}