'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserRound, Pencil, ClipboardList } from 'lucide-react';
import { useAuth } from '../../../src/auth/AuthContext';
import { api, getErrorMessage } from '../../../src/api/client';

type Branch = { id: string; restaurantName: string; name: string };
type Customer = { id: string; name: string; phone: string | null; email: string | null; notes: string | null; createdAt?: string };
type CustomerOrder = { id: string; orderNumber: string; orderType: string; status: string; grandTotal: string | number; createdAt: string; branchName: string };
type FormData = { name: string; phone: string; email: string; notes: string };
const emptyForm: FormData = { name: '', phone: '', email: '', notes: '' };

export default function CustomersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormData>(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
  useEffect(() => {
    api.get<Branch[]>('/org/branches').then(({ data }) => {
      setBranches(data);
      setBranchId((current) => current || data[0]?.id || '');
    }).catch((err) => setError(getErrorMessage(err)));
  }, []);
  useEffect(() => {
    if (!branchId) { setCustomers([]); return; }
    let active = true;
    api.get<Customer[]>('/customers', { params: { branchId, q: query || undefined } })
      .then(({ data }) => { if (active) setCustomers(data); })
      .catch((err) => { if (active) setError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [branchId, query]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) return;
    setBusy(true); setError(''); setNotice('');
    const payload = { ...form, branchId, phone: form.phone || null, email: form.email || null, notes: form.notes || null };
    try {
      if (editingId) await api.patch(`/customers/${editingId}`, payload);
      else await api.post('/customers', payload);
      setForm(emptyForm); setEditingId('');
      const { data } = await api.get<Customer[]>('/customers', { params: { branchId, q: query || undefined } });
      setCustomers(data); setNotice(editingId ? 'Customer details updated.' : 'Customer added.');
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setBusy(false); }
  }

  async function showHistory(customer: Customer) {
    setSelectedId(customer.id); setOrders([]); setError('');
    try {
      const { data } = await api.get<CustomerOrder[]>(`/customers/${customer.id}/orders`, { params: { branchId } });
      setOrders(data);
    } catch (err) { setError(getErrorMessage(err)); }
  }

  function edit(customer: Customer) {
    setEditingId(customer.id);
    setForm({ name: customer.name, phone: customer.phone ?? '', email: customer.email ?? '', notes: customer.notes ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center text-sm text-[#817a74]">Loading customers…</div>;

  return <main className="min-h-screen bg-[#faf7f2] px-4 py-7 text-[#302a26] sm:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-col justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#2563eb]">Emily Cafe · Restaurant Admin</p><h1 className="mt-1 text-2xl font-semibold">Customers</h1><p className="mt-1 text-sm text-[#817a74]">Manage restaurant customers and view their orders.</p></div>
        <label className="text-xs font-medium text-[#817a74]">Branch
          <select value={branchId} onChange={(event) => { setBranchId(event.target.value); setSelectedId(''); setOrders([]); }} className="mt-1 block h-10 min-w-56 rounded-lg border border-[#eee8df] bg-white px-3 text-sm text-[#302a26]">
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.restaurantName} · {branch.name}</option>)}
            {!branches.length && <option value="">No branch available</option>}
          </select>
        </label>
      </header>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.85fr)]">
        <section className="rounded-2xl border border-[#eee8df] bg-white p-5">
          <div className="mb-4 flex items-center gap-2"><UserRound size={18} className="text-[#2563eb]"/><h2 className="font-semibold">Customer directory</h2><span className="ml-auto text-xs text-[#817a74]">{customers.length} shown · up to 100</span></div>
          <label className="relative mb-4 block"><Search size={16} className="absolute left-3 top-3 text-[#aaa29a]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, or email" className="h-10 w-full rounded-lg border border-[#eee8df] pl-9 pr-3 text-sm outline-none focus:border-[#2563eb]"/></label>
          <div className="divide-y divide-[#f1ebe5]">
            {customers.map((customer) => <div key={customer.id} className={`flex flex-wrap items-center gap-3 py-3 ${selectedId === customer.id ? 'rounded-lg bg-blue-50/50 px-2' : ''}`}>
              <button onClick={() => void showHistory(customer)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{customer.name}</span><span className="mt-1 block truncate text-xs text-[#817a74]">{[customer.phone, customer.email].filter(Boolean).join(' · ') || 'No contact details'}</span></button>
              <button onClick={() => edit(customer)} className="rounded-lg border border-[#eee8df] p-2 text-[#817a74] hover:text-[#2563eb]" aria-label={`Edit ${customer.name}`}><Pencil size={15}/></button>
            </div>)}
            {!customers.length && <p className="py-8 text-center text-sm text-[#817a74]">No customers found. Add the first customer here.</p>}
          </div>
        </section>
        <div className="space-y-5">
          <form onSubmit={submit} className="rounded-2xl border border-[#eee8df] bg-white p-5">
            <h2 className="mb-4 font-semibold">{editingId ? 'Edit customer' : 'Add customer'}</h2>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-[#817a74]">Name<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-[#eee8df] px-3 text-sm text-[#302a26]"/></label>
              <label className="block text-xs font-medium text-[#817a74]">Phone<input type="tel" maxLength={32} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-[#eee8df] px-3 text-sm text-[#302a26]"/></label>
              <label className="block text-xs font-medium text-[#817a74]">Email<input type="email" maxLength={191} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-[#eee8df] px-3 text-sm text-[#302a26]"/></label>
              <label className="block text-xs font-medium text-[#817a74]">Notes<textarea maxLength={2000} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 block w-full rounded-lg border border-[#eee8df] p-3 text-sm text-[#302a26]"/></label>
            </div>
            <div className="mt-4 flex gap-2"><button disabled={busy || !branchId} className="rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add customer'}</button>{editingId && <button type="button" onClick={() => { setEditingId(''); setForm(emptyForm); }} className="rounded-lg border border-[#eee8df] px-4 py-2.5 text-sm">Cancel</button>}</div>
          </form>
          <section className="rounded-2xl border border-[#eee8df] bg-white p-5">
            <div className="mb-3 flex items-center gap-2"><ClipboardList size={17} className="text-[#2563eb]"/><h2 className="font-semibold">Order history</h2></div>
            {!selectedId && <p className="text-sm text-[#817a74]">Choose a customer to see orders across branches you can access.</p>}
            {selectedId && !orders.length && <p className="text-sm text-[#817a74]">No orders found for this customer in your accessible branches.</p>}
            <div className="space-y-2">{orders.map((order) => <div key={order.id} className="flex items-center justify-between rounded-lg bg-[#faf7f2] p-3"><div><p className="text-sm font-medium">{order.orderNumber}</p><p className="mt-1 text-xs text-[#817a74]">{order.branchName} · {order.orderType} · {order.status} · {new Date(order.createdAt).toLocaleDateString()}</p></div><strong className="text-sm">₹{Number(order.grandTotal).toFixed(2)}</strong></div>)}</div>
          </section>
        </div>
      </div>
    </div>
  </main>;
}
