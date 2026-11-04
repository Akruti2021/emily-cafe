'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat, LoaderCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../src/auth/AuthContext';
import { api, getErrorMessage } from '../../../src/api/client';

type Branch = { id: string; name: string; role: string };
type KotItem = { id: string; name: string; quantity: number; status: string; instructions: string | null };
type Kot = { id: string; kotNumber: string; orderNumber: string; tableNumber: string | null; status: string; sentAt: string; sentBy: string; items: KotItem[] };
const nextStatus: Record<string, string> = { New: 'Accepted', Accepted: 'Preparing', Preparing: 'Ready', Ready: 'Completed' };

export default function KitchenPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [tickets, setTickets] = useState<Kot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (!authLoading && !user) router.replace('/login'); }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    api.get<Branch[]>('/org/branches/accessible').then(({ data }) => {
      if (!active) return;
      const allowed = data.filter((b) => ['OWNER', 'BRANCH_MANAGER', 'WAITER', 'KITCHEN_STAFF'].includes(b.role));
      setBranches(allowed);
      const selected = allowed.find((b) => b.id === window.localStorage.getItem('active_branch_id')) ?? allowed[0];
      if (selected) setBranchId(selected.id);
    }).catch((err) => { if (active) setError(getErrorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, user]);

  const loadTickets = useCallback(async () => {
    if (!branchId) { setTickets([]); return; }
    try {
      setError('');
      const { data } = await api.get<Kot[]>('/kots', { params: { branchId } });
      setTickets(data);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    void loadTickets();
    const timer = window.setInterval(() => { void loadTickets(); }, 15000);
    return () => window.clearInterval(timer);
  }, [branchId, loadTickets]);

  async function updateItem(itemId: string, status: string) {
    setBusyItem(itemId);
    try {
      await api.patch(`/kots/items/${encodeURIComponent(itemId)}/status`, { status });
      await loadTickets();
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setBusyItem(''); }
  }

  if (authLoading || !user) return null;
  const role = branches.find((b) => b.id === branchId)?.role;
  const canCancel = role === 'OWNER' || role === 'BRANCH_MANAGER';
  const visibleTickets = tickets.filter((ticket) => !['Completed', 'Cancelled'].includes(ticket.status));

  return <main className="min-h-screen bg-[#faf7f2] px-5 py-8 text-[#302a26] sm:px-8"><div className="mx-auto max-w-5xl">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#2563eb]">Kitchen</p><h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight"><ChefHat size={28} /> Order tickets</h1><p className="mt-2 text-sm text-[#817a74]">The queue refreshes every 15 seconds.</p></div>
      {branches.length > 1 && <label className="text-sm font-medium">Branch<select value={branchId} onChange={(e) => { setBranchId(e.target.value); window.localStorage.setItem('active_branch_id', e.target.value); }} className="mt-1 block min-w-52 rounded-xl border border-[#e8e2da] bg-white px-3 py-2.5">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      <button type="button" onClick={() => void loadTickets()} className="inline-flex items-center gap-2 rounded-xl border border-[#e8e2da] bg-white px-4 py-2.5 text-sm font-medium"><RefreshCw size={15} /> Refresh</button></header>
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {!branches.length ? <section className="rounded-2xl border border-dashed border-[#e8e2da] bg-white px-6 py-14 text-center"><h2 className="text-lg font-semibold">Kitchen access is not assigned</h2><p className="mt-2 text-sm text-[#817a74]">Ask the restaurant owner to assign a kitchen staff, waiter, or branch manager role.</p></section>
      : loading ? <p className="flex items-center justify-center rounded-2xl bg-white py-16 text-sm text-[#817a74]"><LoaderCircle className="mr-2 animate-spin" size={17} /> Loading kitchen tickets…</p>
        : visibleTickets.length === 0 ? <section className="rounded-2xl border border-dashed border-[#e8e2da] bg-white px-6 py-14 text-center"><h2 className="text-lg font-semibold">Kitchen queue is clear</h2><p className="mt-2 text-sm text-[#817a74]">New tickets sent from POS will appear here.</p></section>
          : <div className="grid gap-4 md:grid-cols-2">{visibleTickets.map((ticket) => <article key={ticket.id} className="rounded-2xl border border-[#e8e2da] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{ticket.kotNumber}</h2><p className="mt-1 text-xs text-[#817a74]">Order {ticket.orderNumber}{ticket.tableNumber ? ` · Table ${ticket.tableNumber}` : ''}</p><p className="mt-1 text-xs text-[#817a74]">Sent by {ticket.sentBy} · {new Date(ticket.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div><span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-xs font-semibold text-[#2563eb]">{ticket.status}</span></div>
            <ul className="mt-4 divide-y divide-[#f0ebe5]">{ticket.items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{item.quantity} × {item.name}</p>{item.instructions && <p className="mt-1 text-xs text-amber-800">Note: {item.instructions}</p>}<p className="mt-1 text-xs text-[#928b84]">{item.status}</p></div><div className="flex gap-2">{nextStatus[item.status] && <button type="button" disabled={busyItem === item.id} onClick={() => void updateItem(item.id, nextStatus[item.status])} className="rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyItem === item.id ? 'Saving…' : nextStatus[item.status]}</button>}{canCancel && ['New', 'Accepted', 'Preparing'].includes(item.status) && <button type="button" disabled={busyItem === item.id} onClick={() => void updateItem(item.id, 'Cancelled')} className="rounded-lg border border-[#e8e2da] px-3 py-2 text-xs font-medium">Cancel</button>}</div></li>)}</ul></article>)}</div>}
  </div></main>;
}
