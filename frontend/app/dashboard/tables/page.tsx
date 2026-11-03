'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, LoaderCircle, Pencil, Plus, RefreshCw, TableProperties, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '../../../src/auth/AuthContext';
import { api, getErrorMessage } from '../../../src/api/client';

type Area = { id: string; name: string; status: 'active' | 'inactive' };
type TableStatus = 'available' | 'occupied' | 'reserved' | 'out_of_service';
type RestaurantTable = {
  id: string;
  areaId: string;
  areaName: string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
};

const statusLabels: Record<TableStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  out_of_service: 'Out of service',
};
const statusTones: Record<TableStatus, string> = {
  available: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  occupied: 'border-blue-200 bg-blue-50 text-blue-800',
  reserved: 'border-amber-200 bg-amber-50 text-amber-800',
  out_of_service: 'border-stone-200 bg-stone-100 text-stone-700',
};
const emptyForm = { areaId: '', tableNumber: '', capacity: '2' };

export default function TablesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchReady, setBranchReady] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [areaFilter, setAreaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    const timer = window.setTimeout(() => {
      setBranchId(window.localStorage.getItem('active_branch_id'));
      setBranchReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, user]);

  const loadData = useCallback(async () => {
    if (!branchId) return;
    setLoadingData(true);
    setError('');
    try {
      const [areaResponse, tableResponse] = await Promise.all([
        api.get<{ areas: Area[] }>(`/tables/branches/${encodeURIComponent(branchId)}/areas`),
        api.get<{ tables: RestaurantTable[] }>(`/tables/branches/${encodeURIComponent(branchId)}/tables`),
      ]);
      setAreas(areaResponse.data.areas ?? []);
      setTables(tableResponse.data.tables ?? []);
      setForm((current) => ({ ...current, areaId: current.areaId || areaResponse.data.areas?.find((area) => area.status === 'active')?.id || '' }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingData(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (!branchReady || !branchId) return;
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [branchReady, branchId, loadData]);

  const filteredTables = useMemo(() => tables.filter((table) =>
    (areaFilter === 'all' || table.areaId === areaFilter) &&
    (statusFilter === 'all' || table.status === statusFilter),
  ), [tables, areaFilter, statusFilter]);

  const counts = useMemo(() => tables.reduce<Record<TableStatus, number>>((result, table) => {
    result[table.status] += 1;
    return result;
  }, { available: 0, occupied: 0, reserved: 0, out_of_service: 0 }), [tables]);

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, areaId: areas.find((area) => area.status === 'active')?.id ?? '' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) return;
    setSaving(true);
    setError('');
    setNotice('');
    const payload = {
      areaId: form.areaId,
      tableNumber: form.tableNumber.trim(),
      capacity: Number(form.capacity),
    };
    try {
      if (editingId) {
        await api.patch(`/tables/branches/${encodeURIComponent(branchId)}/tables/${encodeURIComponent(editingId)}`, payload);
        setNotice('Table updated.');
      } else {
        await api.post(`/tables/branches/${encodeURIComponent(branchId)}/tables`, payload);
        setNotice('Table added.');
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function startEditing(table: RestaurantTable) {
    setEditingId(table.id);
    setForm({ areaId: table.areaId, tableNumber: table.tableNumber, capacity: String(table.capacity) });
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function updateStatus(tableId: string, status: TableStatus) {
    if (!branchId) return;
    setError('');
    setNotice('');
    try {
      await api.patch(`/tables/branches/${encodeURIComponent(branchId)}/tables/${encodeURIComponent(tableId)}`, { status });
      setTables((current) => current.map((table) => table.id === tableId ? { ...table, status } : table));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function deleteTable(table: RestaurantTable) {
    if (!branchId || !window.confirm(`Delete table “${table.tableNumber}”? This cannot be undone.`)) return;
    setDeletingId(table.id);
    setError('');
    setNotice('');
    try {
      await api.delete(`/tables/branches/${encodeURIComponent(branchId)}/tables/${encodeURIComponent(table.id)}`);
      if (editingId === table.id) resetForm();
      setTables((current) => current.filter((item) => item.id !== table.id));
      setNotice(`${table.tableNumber} deleted.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading || !branchReady) {
    return <main className="flex min-h-screen items-center justify-center bg-[#faf7f2] text-sm text-[#817a74]"><LoaderCircle className="mr-2 animate-spin" size={17} /> Loading tables...</main>;
  }
  if (!user) return null;
  if (!branchId) {
    return (
      <main className="min-h-screen bg-[#faf7f2] px-5 py-10 text-[#302a26]">
        <section className="mx-auto max-w-2xl rounded-2xl border border-[#eee8df] bg-white p-8 shadow-sm">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#817a74] hover:text-[#2563eb]"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="mt-8 text-2xl font-semibold">Set up a branch first</h1>
          <p className="mt-2 text-sm text-[#817a74]">Tables belong to a branch. Add a branch before setting up its tables.</p>
          <Link href="/branch-details" className="mt-6 inline-flex rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]">Add a branch</Link>
        </section>
      </main>
    );
  }

  const selectableAreas = areas.filter((area) => area.status === 'active' || area.id === form.areaId);

  return (
    <main className="min-h-screen bg-[#faf7f2] px-5 py-8 text-[#302a26] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#817a74] transition hover:text-[#2563eb]"><ArrowLeft size={16} /> Dashboard</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#2563eb]">Floor setup</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tables</h1>
            <p className="mt-2 text-sm text-[#817a74]">Set table capacity and keep service status up to date.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/tables/areas" className="inline-flex items-center gap-2 rounded-xl border border-[#eee8df] bg-white px-3.5 py-2.5 text-sm font-medium text-[#514942] hover:bg-[#fffdfa]"><Layers size={15} /> Areas</Link>
            <button type="button" onClick={() => void loadData()} disabled={loadingData} className="inline-flex items-center gap-2 rounded-xl border border-[#eee8df] bg-white px-3.5 py-2.5 text-sm font-medium text-[#514942] hover:bg-[#fffdfa] disabled:opacity-50"><RefreshCw size={15} className={loadingData ? 'animate-spin' : ''} /> Refresh</button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['available', 'occupied', 'reserved', 'out_of_service'] as TableStatus[]).map((status) => (
            <div key={status} className="rounded-xl border border-[#eee8df] bg-white p-4">
              <p className="text-xs text-[#928b84]">{statusLabels[status]}</p>
              <p className="mt-2 text-xl font-semibold">{counts[status]}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="h-fit rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_2px_12px_rgba(72,45,25,.025)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{editingId ? 'Edit table' : 'Add a table'}</h2>
                <p className="mt-1 text-xs text-[#928b84]">Assign a table to one of your active areas.</p>
              </div>
              {editingId && <button type="button" onClick={resetForm} aria-label="Cancel editing" className="rounded-lg p-1.5 text-[#928b84] hover:bg-[#f5f2ed]"><X size={17} /></button>}
            </div>
            {selectableAreas.length === 0 ? (
              <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                Add or activate a dining area before creating tables.
                <Link href="/dashboard/tables/areas" className="mt-2 block font-semibold underline">Manage dining areas</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <label className="block text-xs font-medium text-[#625a53]">Dining area
                  <select required value={form.areaId} onChange={(event) => setForm((current) => ({ ...current, areaId: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#e8e2da] bg-white px-3 py-3 text-sm outline-none focus:border-[#8bb6ff] focus:ring-2 focus:ring-blue-100">
                    <option value="" disabled>Select an area</option>
                    {selectableAreas.map((area) => <option key={area.id} value={area.id}>{area.name}{area.status === 'inactive' ? ' (inactive)' : ''}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-medium text-[#625a53]">Table name or number
                  <input value={form.tableNumber} onChange={(event) => setForm((current) => ({ ...current, tableNumber: event.target.value }))} placeholder="e.g. T1 or Window 1" required maxLength={40} className="mt-1.5 w-full rounded-xl border border-[#e8e2da] bg-white px-3.5 py-3 text-sm outline-none placeholder:text-[#b3aca4] focus:border-[#8bb6ff] focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="block text-xs font-medium text-[#625a53]">Seats
                  <input type="number" value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} min={1} max={50} required className="mt-1.5 w-full rounded-xl border border-[#e8e2da] bg-white px-3.5 py-3 text-sm outline-none focus:border-[#8bb6ff] focus:ring-2 focus:ring-blue-100" />
                </label>
                {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
                {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">{notice}</p>}
                <button type="submit" disabled={saving || !form.areaId || !form.tableNumber.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? <LoaderCircle size={16} className="animate-spin" /> : editingId ? <Pencil size={15} /> : <Plus size={17} />}
                  {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add table'}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_2px_12px_rgba(72,45,25,.025)] sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="font-semibold">Table map</h2><p className="mt-1 text-xs text-[#928b84]">{filteredTables.length} of {tables.length} tables</p></div>
              <div className="flex flex-wrap gap-2">
                <select aria-label="Filter tables by area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} className="rounded-lg border border-[#e8e2da] bg-white px-3 py-2 text-xs text-[#514942]">
                  <option value="all">All areas</option>
                  {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
                <select aria-label="Filter tables by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-[#e8e2da] bg-white px-3 py-2 text-xs text-[#514942]">
                  <option value="all">All statuses</option>
                  {Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
                </select>
              </div>
            </div>

            {error && tables.length > 0 && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
            {loadingData ? (
              <div className="flex min-h-48 items-center justify-center text-sm text-[#928b84]"><LoaderCircle size={17} className="mr-2 animate-spin" /> Loading tables...</div>
            ) : error && tables.length === 0 ? (
              <div role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : filteredTables.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-[#e8e2da] px-5 py-12 text-center">
                <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[#f5f2ed] text-[#817a74]"><TableProperties size={19} /></div>
                <h3 className="mt-3 text-sm font-semibold">{tables.length ? 'No tables match these filters' : 'No tables yet'}</h3>
                <p className="mt-1 text-xs text-[#928b84]">{tables.length ? 'Choose another area or status.' : 'Add a table to start building your seating map.'}</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {filteredTables.map((table) => (
                  <article key={table.id} className="rounded-xl border border-[#eee8df] p-4 transition hover:border-[#d7d0c7]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#eff6ff] text-[#2563eb]"><TableProperties size={20} /></div>
                        <div className="min-w-0"><h3 className="truncate font-semibold">{table.tableNumber}</h3><p className="mt-0.5 truncate text-xs text-[#928b84]">{table.areaName}</p></div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => startEditing(table)} aria-label={`Edit ${table.tableNumber}`} className="rounded-lg p-2 text-[#817a74] hover:bg-[#eff6ff] hover:text-[#2563eb]"><Pencil size={14} /></button>
                        <button type="button" onClick={() => void deleteTable(table)} disabled={deletingId === table.id} aria-label={`Delete ${table.tableNumber}`} className="rounded-lg p-2 text-[#817a74] hover:bg-red-50 hover:text-red-600 disabled:opacity-50">{deletingId === table.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}</button>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#817a74]"><Users size={14} /> {table.capacity} seats</span>
                      <select aria-label={`Status for ${table.tableNumber}`} value={table.status} onChange={(event) => void updateStatus(table.id, event.target.value as TableStatus)} className={`max-w-[150px] rounded-full border px-2.5 py-1.5 text-[11px] font-semibold outline-none ${statusTones[table.status]}`}>
                        {Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
