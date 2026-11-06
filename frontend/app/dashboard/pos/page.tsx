'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LoaderCircle, Minus, Plus, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../../src/auth/AuthContext';
import { api, getErrorMessage } from '../../../src/api/client';

type Branch = { id: string; restaurantId: string; restaurantName: string; name: string; code: string; role: string };
type DiningTable = { id: string; tableNumber: string; areaName: string; capacity: number; status: string };
type MenuItem = { id: string; name: string; description: string | null; price: number; taxRate: number; status?: string; variants?: Array<{id:string;name:string;priceDelta:number}>; addonGroups?: Array<{id:string;name:string;minSelections:number;maxSelections:number;addons:Array<{id:string;name:string;priceDelta:number}>}> };
type MenuCategory = { id: string; name: string; items: MenuItem[] };
type CreatedOrder = { id: string; orderNumber: string; subtotal: number; taxTotal: number; grandTotal: number };

const money = (value: number | string) => '₹' + Number(value).toFixed(2);

export default function PosPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tableId, setTableId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [variants, setVariants] = useState<Record<string,string>>({});
  const [addons, setAddons] = useState<Record<string,string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<CreatedOrder | null>(null);
  const [kotNumber, setKotNumber] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    api.get<Branch[]>('/org/branches/accessible')
      .then(({ data }) => {
        if (!active) return;
        setBranches(data);
        const saved = window.localStorage.getItem('active_branch_id');
        const eligible = data.filter((item) =>
          ['OWNER', 'BRANCH_MANAGER', 'CASHIER', 'WAITER'].includes(item.role),
        );
        const branch = eligible.find((item) => item.id === saved) ?? eligible[0];
        if (branch) {
          setBranchId(branch.id);
          window.localStorage.setItem('active_branch_id', branch.id);
        }
      })
      .catch((err) => { if (active) setError(getErrorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, user]);

  const posBranches = branches.filter((item) =>
    ['OWNER', 'BRANCH_MANAGER', 'CASHIER', 'WAITER'].includes(item.role),
  );
  const branch = posBranches.find((item) => item.id === branchId);
  const loadBranchData = useCallback(async () => {
    if (!branch) return;
    setError('');
    setLoading(true);
    try {
      const [tableResponse, menuResponse] = await Promise.all([
        api.get<{ tables: DiningTable[] }>(`/tables/branches/${encodeURIComponent(branch.id)}/tables`),
        api.get<{ categories: MenuCategory[] }>(`/menu/${encodeURIComponent(branch.restaurantId)}`),
      ]);
      setTables(tableResponse.data.tables ?? []);
      setCategories(menuResponse.data.categories ?? []);
      setTableId('');
      setQuantities({});
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [branch]);

  useEffect(() => { void loadBranchData(); }, [loadBranchData]);

  const items = useMemo(() =>
    categories.flatMap((category) => category.items.map((item) => ({ ...item, categoryName: category.name }))),
  [categories]);
  const selectedItems = items.filter((item) => (quantities[item.id] ?? 0) > 0);
  const configuredPrice = (item: MenuItem) => Number(item.price) + Number(item.variants?.find((v) => v.id === variants[item.id])?.priceDelta ?? 0) + (item.addonGroups ?? []).flatMap((g) => g.addons).filter((a) => (addons[item.id] ?? []).includes(a.id)).reduce((s,a) => s + Number(a.priceDelta), 0);
  const subtotal = selectedItems.reduce((sum, item) => sum + configuredPrice(item) * quantities[item.id], 0);
  const estimatedTax = selectedItems.reduce((sum, item) => sum + configuredPrice(item) * quantities[item.id] * item.taxRate / 100, 0);
  const availableTables = tables.filter((table) => table.status === 'available');

  function changeQuantity(itemId: string, delta: number) {
    setSuccess(null);
    setQuantities((current) => {
      const next = Math.max(0, Math.min(20, (current[itemId] ?? 0) + delta));
      return { ...current, [itemId]: next };
    });
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branch || !tableId || selectedItems.length === 0) return;
    setSaving(true);
    setError('');
    setSuccess(null);
    try {
      const { data } = await api.post<CreatedOrder>('/orders/pos/dine-in', {
        branchId: branch.id,
        tableId,
        items: selectedItems.map((item) => ({ menuItemId: item.id, quantity: quantities[item.id], ...(variants[item.id] ? { variantId: variants[item.id] } : {}), addonIds: addons[item.id] ?? [] })),
      });
      setSuccess(data);
      setKotNumber('');
      setTableId('');
      setQuantities({});
      await loadBranchData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function sendKot() {
    if (!success) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post<{ kotNumber: string }>(`/kots/orders/${encodeURIComponent(success.id)}`);
      setKotNumber(data.kotNumber);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || (loading && branches.length === 0)) {
    return <main className="flex min-h-screen items-center justify-center bg-[#faf7f2] text-sm text-[#817a74]"><LoaderCircle className="mr-2 animate-spin" size={17} /> Loading POS...</main>;
  }
  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#faf7f2] px-5 py-8 text-[#302a26] sm:px-8">
      <div className="mx-auto max-w-6xl">
        {user.role === 'OWNER' && <button type="button" onClick={() => router.push('/dashboard')} className="mb-6 inline-flex items-center gap-2 text-sm text-[#817a74] hover:text-[#2563eb]"><ArrowLeft size={16} /> Dashboard</button>}
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#2563eb]">Point of sale</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dine-in order</h1>
            <p className="mt-2 text-sm text-[#817a74]">Choose an available table and add items from the active menu.</p>
          </div>
          {branches.some((item) => ['OWNER', 'BRANCH_MANAGER', 'WAITER', 'KITCHEN_STAFF'].includes(item.role)) && <Link href="/dashboard/kitchen" className="rounded-xl border border-[#e8e2da] bg-white px-4 py-2.5 text-sm font-medium text-[#514942] hover:bg-[#fffdfa]">Kitchen queue</Link>}
          {posBranches.length > 1 && (
            <label className="text-sm font-medium">
              Branch
              <select value={branchId} onChange={(event) => {
                setBranchId(event.target.value);
                window.localStorage.setItem('active_branch_id', event.target.value);
                setSuccess(null);
              }} className="mt-1 block min-w-56 rounded-xl border border-[#e8e2da] bg-white px-3 py-2.5">
                {posBranches.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.role.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
          )}
          {branch && ['OWNER', 'BRANCH_MANAGER'].includes(branch.role) && (
            <Link href="/dashboard/team" className="rounded-xl border border-[#e8e2da] bg-white px-4 py-2.5 text-sm font-medium text-[#514942] hover:bg-[#fffdfa]">Team access</Link>
          )}
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {success && <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span>Order {success.orderNumber} created. Total {money(success.grandTotal)}. The table is now occupied.{kotNumber && <> KOT {kotNumber} sent to the kitchen.</>}</span>{!kotNumber && branch && ['OWNER', 'BRANCH_MANAGER', 'WAITER'].includes(branch.role) && <button type="button" onClick={sendKot} disabled={saving} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Sending…' : 'Send KOT to kitchen'}</button>}</div>}

        {branches.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[#e8e2da] bg-white px-6 py-14 text-center">
            <h2 className="text-lg font-semibold">No branch access yet</h2>
            <p className="mt-2 text-sm text-[#817a74]">Ask the restaurant owner to assign you a role for a branch.</p>
          </section>
        ) : posBranches.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[#e8e2da] bg-white px-6 py-14 text-center">
            <h2 className="text-lg font-semibold">POS access is not assigned to your role</h2>
            <p className="mt-2 text-sm text-[#817a74]">Ask the restaurant owner to assign a cashier, waiter, or branch manager role for POS work.</p>
          </section>
        ) : (
          <form onSubmit={submitOrder} className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="rounded-2xl border border-[#e8e2da] bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-2">
                <UtensilsCrossed className="text-[#2563eb]" size={18} />
                <h2 className="font-semibold">Menu</h2>
              </div>
              {loading ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-[#817a74]"><LoaderCircle size={17} className="mr-2 animate-spin" /> Loading menu and tables...</div>
              ) : items.length === 0 ? (
                <p className="rounded-xl bg-stone-50 p-5 text-sm text-[#817a74]">There are no active menu items for this restaurant.</p>
              ) : (
                <div className="space-y-6">
                  {categories.map((category) => {
                    const activeItems = category.items.filter((item) => item.status !== 'inactive');
                    if (activeItems.length === 0) return null;
                    return (
                      <div key={category.id}>
                        <h3 className="mb-3 text-sm font-semibold text-[#817a74]">{category.name}</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {activeItems.map((item) => (
                            <article key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#eee8df] p-4">
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-semibold">{item.name}</h4>
                                <p className="mt-1 text-xs text-[#817a74]">{money(configuredPrice(item))} · Tax {Number(item.taxRate)}%</p>
                                {!!item.variants?.length && <select aria-label={`${item.name} variant`} className="mt-2 block w-full rounded-lg border border-[#e8e2da] p-2 text-xs" value={variants[item.id] ?? ''} onChange={(e) => setVariants((s) => ({...s,[item.id]:e.target.value}))}><option value="">Default</option>{item.variants.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.priceDelta >= 0 ? '+' : ''}{money(v.priceDelta)})</option>)}</select>}
                                {(item.addonGroups ?? []).map((group) => <fieldset key={group.id} className="mt-2 text-xs"><legend className="font-medium">{group.name} · choose {group.minSelections === group.maxSelections ? group.minSelections : `${group.minSelections}–${group.maxSelections}`}</legend>{group.addons.map((addon) => <label key={addon.id} className="mr-2 inline-flex items-center gap-1"><input type="checkbox" checked={(addons[item.id] ?? []).includes(addon.id)} onChange={(e) => setAddons((s) => { const selected=s[item.id]??[]; return {...s,[item.id]:e.target.checked?[...selected,addon.id]:selected.filter((id)=>id!==addon.id)}; })} />{addon.name} (+{money(addon.priceDelta)})</label>)}</fieldset>)}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={'Remove one ' + item.name} className="rounded-lg border border-[#e8e2da] p-2 disabled:opacity-40" disabled={!quantities[item.id]}><Minus size={14} /></button>
                                <span className="w-5 text-center text-sm tabular-nums">{quantities[item.id] ?? 0}</span>
                                <button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={'Add one ' + item.name} className="rounded-lg border border-[#e8e2da] p-2 disabled:opacity-40" disabled={(quantities[item.id] ?? 0) >= 20}><Plus size={14} /></button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="h-fit rounded-2xl border border-[#e8e2da] bg-white p-5 sm:p-6 lg:sticky lg:top-6">
              <div className="mb-5 flex items-center gap-2">
                <ShoppingBag className="text-[#2563eb]" size={18} />
                <h2 className="font-semibold">Current order</h2>
              </div>
              <label className="block text-sm font-medium">
                Table
                <select required value={tableId} onChange={(event) => setTableId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e8e2da] bg-white px-3 py-3 text-sm">
                  <option value="">Choose an available table</option>
                  {availableTables.map((table) => <option key={table.id} value={table.id}>{table.tableNumber} · {table.areaName} · {table.capacity} seats</option>)}
                </select>
              </label>
              {availableTables.length === 0 && !loading && <p className="mt-2 text-xs text-amber-700">No available tables in this branch.</p>}
              <div className="my-5 space-y-3 border-y border-[#eee8df] py-4">
                {selectedItems.length === 0 ? <p className="text-sm text-[#928b84]">Add menu items to start.</p> : selectedItems.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 text-sm">
                    <span>{quantities[item.id]} × {item.name}{variants[item.id] ? ` · ${item.variants?.find((v)=>v.id===variants[item.id])?.name}` : ''}</span>
                    <span className="tabular-nums">{money(configuredPrice(item) * quantities[item.id])}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                <div className="flex justify-between"><span>Estimated tax</span><span>{money(estimatedTax)}</span></div>
                <div className="flex justify-between border-t border-[#eee8df] pt-3 text-base font-semibold"><span>Estimated total</span><span>{money(subtotal + estimatedTax)}</span></div>
              </div>
              <p className="mt-3 text-xs text-[#928b84]">Final amounts are recalculated by the server from current menu prices and tax rates.</p>
              <button type="submit" disabled={saving || !tableId || selectedItems.length === 0 || loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <><LoaderCircle size={16} className="animate-spin" /> Saving order...</> : 'Create dine-in order'}
              </button>
            </aside>
          </form>
        )}
      </div>
    </main>
  );
}
