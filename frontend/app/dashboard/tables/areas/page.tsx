'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, LoaderCircle, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useAuth } from '../../../../src/auth/AuthContext';
import { api, getErrorMessage } from '../../../../src/api/client';

type DiningArea = {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
};

type DiningAreasResponse = { areas: DiningArea[] };

const emptyForm = { name: '', description: '' };

export default function AreasPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchReady, setBranchReady] = useState(false);
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
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

  const loadAreas = useCallback(async () => {
    if (!branchId) return;
    setLoadingAreas(true);
    setError('');
    try {
      const { data } = await api.get<DiningAreasResponse>(
        `/tables/branches/${encodeURIComponent(branchId)}/areas`,
      );
      setAreas(data.areas ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingAreas(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (!branchReady || !branchId) return;
    const timer = window.setTimeout(() => { void loadAreas(); }, 0);
    return () => window.clearTimeout(timer);
  }, [branchReady, branchId, loadAreas]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) return;
    setSaving(true);
    setError('');
    setNotice('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
    };

    try {
      if (editingId) {
        await api.patch(
          `/tables/branches/${encodeURIComponent(branchId)}/areas/${encodeURIComponent(editingId)}`,
          payload,
        );
        setNotice('Dining area updated.');
      } else {
        await api.post(`/tables/branches/${encodeURIComponent(branchId)}/areas`, payload);
        setNotice('Dining area added.');
      }
      resetForm();
      await loadAreas();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function startEditing(area: DiningArea) {
    setEditingId(area.id);
    setForm({ name: area.name, description: area.description ?? '' });
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggleStatus(area: DiningArea) {
    if (!branchId) return;
    setError('');
    setNotice('');
    try {
      await api.patch(
        `/tables/branches/${encodeURIComponent(branchId)}/areas/${encodeURIComponent(area.id)}`,
        { status: area.status === 'active' ? 'inactive' : 'active' },
      );
      setNotice(`${area.name} ${area.status === 'active' ? 'deactivated' : 'activated'}.`);
      await loadAreas();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function deleteArea(area: DiningArea) {
    if (!branchId || !window.confirm(`Delete “${area.name}”? This cannot be undone.`)) return;
    setDeletingId(area.id);
    setError('');
    setNotice('');
    try {
      await api.delete(
        `/tables/branches/${encodeURIComponent(branchId)}/areas/${encodeURIComponent(area.id)}`,
      );
      if (editingId === area.id) resetForm();
      setNotice(`${area.name} deleted.`);
      await loadAreas();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading || !branchReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf7f2] text-sm text-[#817a74]">
        <LoaderCircle className="mr-2 animate-spin" size={17} /> Loading dining areas...
      </main>
    );
  }

  if (!user) return null;

  if (!branchId) {
    return (
      <main className="min-h-screen bg-[#faf7f2] px-5 py-10 text-[#302a26]">
        <section className="mx-auto max-w-2xl rounded-2xl border border-[#eee8df] bg-white p-8 shadow-sm">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#817a74] hover:text-[#2563eb]">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <h1 className="mt-8 text-2xl font-semibold">Set up a branch first</h1>
          <p className="mt-2 text-sm text-[#817a74]">Dining areas belong to a branch. Add or select a branch before managing its floor areas.</p>
          <Link href="/branch-details" className="mt-6 inline-flex rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]">
            Add a branch
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] px-5 py-8 text-[#302a26] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#817a74] transition hover:text-[#2563eb]">
          <ArrowLeft size={16} /> Dashboard
        </Link>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#2563eb]">Floor setup</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dining Areas</h1>
            <p className="mt-2 text-sm text-[#817a74]">Organize your seating by floor, room, or outdoor section.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadAreas()}
            disabled={loadingAreas}
            className="inline-flex items-center gap-2 rounded-xl border border-[#eee8df] bg-white px-3.5 py-2.5 text-sm font-medium text-[#514942] transition hover:bg-[#fffdfa] disabled:opacity-50"
          >
            <RefreshCw size={15} className={loadingAreas ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="h-fit rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_2px_12px_rgba(72,45,25,.025)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">{editingId ? 'Edit dining area' : 'Add an area'}</h2>
                <p className="mt-1 text-xs text-[#928b84]">Examples: Indoor, Patio, or Rooftop.</p>
              </div>
              {editingId && (
                <button type="button" onClick={resetForm} aria-label="Cancel editing" className="rounded-lg p-1.5 text-[#928b84] hover:bg-[#f5f2ed] hover:text-[#302a26]">
                  <X size={17} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block text-xs font-medium text-[#625a53]">
                Area name
                <input
                  autoFocus={Boolean(editingId)}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Indoor"
                  required
                  minLength={2}
                  maxLength={100}
                  className="mt-1.5 w-full rounded-xl border border-[#e8e2da] bg-white px-3.5 py-3 text-sm text-[#302a26] outline-none transition placeholder:text-[#b3aca4] focus:border-[#8bb6ff] focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block text-xs font-medium text-[#625a53]">
                Description <span className="font-normal text-[#928b84]">(optional)</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Add a note about this seating area"
                  maxLength={255}
                  rows={3}
                  className="mt-1.5 w-full resize-y rounded-xl border border-[#e8e2da] bg-white px-3.5 py-3 text-sm text-[#302a26] outline-none transition placeholder:text-[#b3aca4] focus:border-[#8bb6ff] focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
              {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">{notice}</p>}

              <button
                type="submit"
                disabled={saving || form.name.trim().length < 2}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <LoaderCircle size={16} className="animate-spin" /> : editingId ? <Pencil size={15} /> : <Plus size={17} />}
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add dining area'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_2px_12px_rgba(72,45,25,.025)] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Your areas</h2>
                <p className="mt-1 text-xs text-[#928b84]">{areas.length} {areas.length === 1 ? 'area' : 'areas'} in this branch</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#eff6ff] text-[#2563eb]">
                <Layers size={19} />
              </div>
            </div>

            {loadingAreas ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-[#928b84]">
                <LoaderCircle size={17} className="mr-2 animate-spin" /> Loading areas...
              </div>
            ) : error && areas.length === 0 ? (
              <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
            ) : areas.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-[#e8e2da] px-5 py-10 text-center">
                <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[#f5f2ed] text-[#817a74]"><Layers size={19} /></div>
                <h3 className="mt-3 text-sm font-semibold">No dining areas yet</h3>
                <p className="mt-1 text-xs text-[#928b84]">Add an area to start arranging your floor.</p>
              </div>
            ) : (
              <ul className="mt-5 space-y-3">
                {areas.map((area) => (
                  <li key={area.id} className="rounded-xl border border-[#eee8df] p-4 transition hover:border-[#d7d0c7]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[#3a342f]">{area.name}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${area.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
                            {area.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-[#817a74]">{area.description || 'No description'}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => void toggleStatus(area)} className="rounded-lg px-2.5 py-2 text-xs font-medium text-[#625a53] hover:bg-[#f5f2ed]">
                          {area.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" onClick={() => startEditing(area)} aria-label={`Edit ${area.name}`} className="rounded-lg p-2 text-[#817a74] hover:bg-[#eff6ff] hover:text-[#2563eb]">
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => void deleteArea(area)} disabled={deletingId === area.id} aria-label={`Delete ${area.name}`} className="rounded-lg p-2 text-[#817a74] hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                          {deletingId === area.id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
