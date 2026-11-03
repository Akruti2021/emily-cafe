'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { ArrowLeft, Download, ExternalLink, LoaderCircle, Printer, QrCode, RefreshCw, TableProperties } from 'lucide-react';
import { useAuth } from '../../../../src/auth/AuthContext';
import { api, getErrorMessage } from '../../../../src/api/client';

type RestaurantTable = {
  id: string;
  restaurantId: string;
  areaId: string;
  areaName: string;
  tableNumber: string;
  capacity: number;
  status: string;
};
type QrCard = RestaurantTable & { image: string; targetUrl: string };

export default function QrCodesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchReady, setBranchReady] = useState(false);
  const [cards, setCards] = useState<QrCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [areaFilter, setAreaFilter] = useState('all');
  const [error, setError] = useState('');

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

  const loadCards = useCallback(async () => {
    if (!branchId) return;
    setLoadingCards(true);
    setError('');
    try {
      const { data } = await api.get<{ tables: RestaurantTable[] }>(
        `/tables/branches/${encodeURIComponent(branchId)}/tables`,
      );
      const origin = window.location.origin;
      const generated = await Promise.all((data.tables ?? []).map(async (table) => {
        const targetUrl = `${origin}/?restaurantId=${encodeURIComponent(table.restaurantId)}&tableId=${encodeURIComponent(table.id)}#meals`;
        const image = await QRCode.toDataURL(targetUrl, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#211c18', light: '#ffffff' },
        });
        return { ...table, image, targetUrl };
      }));
      setCards(generated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingCards(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (!branchReady || !branchId) return;
    const timer = window.setTimeout(() => { void loadCards(); }, 0);
    return () => window.clearTimeout(timer);
  }, [branchReady, branchId, loadCards]);

  const areas = useMemo(() => [...new Set(cards.map((card) => card.areaName))].sort(), [cards]);
  const visibleCards = areaFilter === 'all' ? cards : cards.filter((card) => card.areaName === areaFilter);

  if (authLoading || !branchReady) {
    return <main className="flex min-h-screen items-center justify-center bg-[#faf7f2] text-sm text-[#817a74]"><LoaderCircle className="mr-2 animate-spin" size={17} /> Loading QR cards...</main>;
  }
  if (!user) return null;
  if (!branchId) {
    return (
      <main className="min-h-screen bg-[#faf7f2] px-5 py-10 text-[#302a26] print:hidden">
        <section className="mx-auto max-w-2xl rounded-2xl border border-[#eee8df] bg-white p-8 shadow-sm">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#817a74] hover:text-[#2563eb]"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="mt-8 text-2xl font-semibold">Set up a branch first</h1>
          <p className="mt-2 text-sm text-[#817a74]">QR cards are generated for the tables in your active branch.</p>
          <Link href="/branch-details" className="mt-6 inline-flex rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]">Add a branch</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] px-5 py-8 text-[#302a26] sm:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-6xl">
        <div className="print:hidden">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#817a74] transition hover:text-[#2563eb]"><ArrowLeft size={16} /> Dashboard</Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#2563eb]">Guest ordering</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Table QR Cards</h1>
              <p className="mt-2 text-sm text-[#817a74]">Each code opens the public menu with that table&apos;s ID attached.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Filter QR cards by area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} className="rounded-xl border border-[#eee8df] bg-white px-3.5 py-2.5 text-sm text-[#514942]">
                <option value="all">All areas</option>
                {areas.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
              <button type="button" onClick={() => void loadCards()} disabled={loadingCards} className="inline-flex items-center gap-2 rounded-xl border border-[#eee8df] bg-white px-3.5 py-2.5 text-sm font-medium text-[#514942] hover:bg-[#fffdfa] disabled:opacity-50"><RefreshCw size={15} className={loadingCards ? 'animate-spin' : ''} /> Refresh</button>
              <button type="button" onClick={() => window.print()} disabled={visibleCards.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"><Printer size={15} /> Print cards</button>
            </div>
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">{error}</p>}
        {loadingCards ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-[#928b84] print:hidden"><LoaderCircle size={17} className="mr-2 animate-spin" /> Generating table QR codes...</div>
        ) : visibleCards.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-dashed border-[#e8e2da] bg-white px-5 py-14 text-center print:hidden">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb]"><QrCode size={21} /></div>
            <h2 className="mt-4 text-base font-semibold">No tables to print yet</h2>
            <p className="mt-1 text-sm text-[#817a74]">Create dining areas and tables first, then return here to download or print their cards.</p>
            <Link href="/dashboard/tables" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]"><TableProperties size={15} /> Manage tables</Link>
          </section>
        ) : (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 print:mt-0 print:grid-cols-2 print:gap-4">
            {visibleCards.map((card) => (
              <article key={card.id} className="break-inside-avoid rounded-2xl border border-[#e8e2da] bg-white p-5 text-center shadow-[0_2px_12px_rgba(72,45,25,.025)] print:rounded-lg print:border-stone-300 print:p-4 print:shadow-none">
                <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#928b84]">Emily Cafe</p>
                <h2 className="mt-2 text-xl font-semibold">{card.tableNumber}</h2>
                <p className="mt-1 text-sm text-[#817a74]">{card.areaName} · {card.capacity} seats</p>
                <img src={card.image} alt={`QR code for ${card.tableNumber}`} width={240} height={240} className="mx-auto mt-4 size-52 max-w-full object-contain print:size-48" />
                <p className="mt-3 text-xs text-[#817a74]">Scan to view the menu</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 print:hidden">
                  <a href={card.targetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#eee8df] px-3 py-2 text-xs font-semibold text-[#514942] hover:bg-[#f8f6f2]"><ExternalLink size={14} /> Preview menu</a>
                  <a href={card.image} download={`emily-cafe-${card.tableNumber.replace(/[^a-z0-9_-]+/gi, '-')}-qr.png`} className="inline-flex items-center gap-2 rounded-lg border border-[#eee8df] px-3 py-2 text-xs font-semibold text-[#514942] hover:bg-[#f8f6f2]"><Download size={14} /> Download PNG</a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
