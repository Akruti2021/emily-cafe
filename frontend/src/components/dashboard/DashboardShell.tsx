'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  LayoutDashboard,
  Layers,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquare,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  TableProperties,
  TrendingUp,
  Utensils,
  UtensilsCrossed,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { api, getErrorMessage } from '../../api/client';

type ActiveOrder = {
  id: string;
  orderNumber: string;
  tableNumber: string | null;
  title: string;
  status: string;
  grandTotal: number;
  createdAt: string;
};

type OrderHistoryResponse = { items: ActiveOrder[]; total: number };
const activeStatuses = ['PENDING', 'PREPARING', 'READY', 'CANCELLED'] as const;
const activeOrderRoles = ['OWNER', 'BRANCH_MANAGER', 'CASHIER', 'WAITER'];
const refreshIntervalMs = 15_000;

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'POS', icon: ShoppingBag, href: '/dashboard/pos' },
  { label: 'Billing & Payments', icon: Receipt, href: '/dashboard/billing' },
  { label: 'Kitchen', icon: UtensilsCrossed, href: '/dashboard/kitchen' },
  { label: 'Team access', icon: Users, href: '/dashboard/team' },
  { label: 'Menu Management', icon: UtensilsCrossed, href: '/menu' },
  { label: 'Analytics', icon: BarChart3, href: '#analytics' },
  { label: 'Order', icon: ShoppingBag, href: '#orders' },
  { label: 'Customer', icon: Users, href: '/dashboard/customers' },
  { label: 'Sales', icon: TrendingUp, href: '#sales' },
  { label: 'Messages', icon: MessageSquare, badge: '12', href: '#messages' },
];

const tableLinks = [
  { label: 'Areas', href: '/dashboard/tables/areas', icon: Layers },
  { label: 'Tables', href: '/dashboard/tables', icon: TableProperties },
  { label: 'QR Codes', href: '/dashboard/tables/qr-code', icon: QrCode },
];

function targetFor(href: string) {
  return href.startsWith('#') ? `/dashboard${href}` : href;
}

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatStatus(status: string) {
  return status.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function fetchAllOrdersForStatus(branchId: string | null, status: (typeof activeStatuses)[number]) {
  const items: ActiveOrder[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const { data } = await api.get<OrderHistoryResponse>('/orders/history', {
      params: { ...(branchId ? { branchId } : {}), status, limit: 100, offset },
    });
    items.push(...data.items);
    total = data.total;
    if (data.items.length === 0) break;
    offset += data.items.length;
  }

  return items;
}

function Sidebar({
  pathname,
  mobileOpen,
  onClose,
  collapsed,
  tablesOpen,
  onToggleTables,
}: {
  pathname: string;
  mobileOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  tablesOpen: boolean;
  onToggleTables: () => void;
}) {
  const linkClass = (active: boolean) => `flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors ${
    active ? 'bg-[#eff6ff] text-[#2563eb]' : 'text-[#817a74] hover:bg-[#f1f5f9]'
  } ${collapsed ? 'lg:justify-center lg:px-2' : ''}`;

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-30 bg-black/25 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-[#eee8df] bg-[#fffdfa] px-5 py-6 transition-[width,transform,padding] duration-200 lg:static lg:z-auto lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${collapsed ? 'lg:w-[76px] lg:px-2' : 'lg:w-[250px]'}`}>
        <div className={`mb-8 flex items-center justify-between px-2 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#3b82f6] text-white"><Utensils size={19} /></div>
            <span className={`truncate text-[19px] font-semibold tracking-tight text-[#2d2925] ${collapsed ? 'lg:hidden' : ''}`}>Emily Cafe</span>
          </div>
          <button type="button" onClick={onClose} className="text-[#aaa29a] lg:hidden" aria-label="Close menu"><X size={18} /></button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Dashboard navigation">
          <p className={`mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[#aaa29a] ${collapsed ? 'lg:hidden' : ''}`}>Menu</p>
          <div className="flex flex-col gap-1.5">
            {navItems.map(({ label, icon: Icon, badge, href }) => {
              const target = targetFor(href);
              const active = href.startsWith('#') ? false : isActivePath(pathname, href);
              return (
                <Link key={label} href={target} title={collapsed ? label : undefined} aria-label={label} aria-current={active ? 'page' : undefined} onClick={onClose} className={linkClass(active)}>
                  <Icon size={17} strokeWidth={1.8} className="shrink-0" />
                  <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
                  {badge && <span className={`ml-auto rounded-full bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-bold text-white ${collapsed ? 'lg:hidden' : ''}`}>{badge}</span>}
                </Link>
              );
            })}
            <button type="button" title={collapsed ? 'Tables' : undefined} aria-label="Tables" aria-expanded={tablesOpen} aria-controls="tables-navigation" onClick={onToggleTables} className={`${linkClass(pathname.startsWith('/dashboard/tables'))} text-left`}>
              <TableProperties size={17} strokeWidth={1.8} className="shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>Tables</span>
              <ChevronDown size={15} className={`ml-auto transition-transform ${tablesOpen ? 'rotate-180' : ''} ${collapsed ? 'lg:hidden' : ''}`} />
            </button>
            {tablesOpen && <div id="tables-navigation" className={`flex flex-col gap-1 border-l border-[#eee8df] pl-3 ${collapsed ? 'ml-5 lg:ml-0 lg:border-0 lg:pl-0' : 'ml-5'}`}>
              {tableLinks.map(({ label, href, icon: Icon }) => {
                const active = pathname === href;
                return <Link key={href} href={href} title={collapsed ? label : undefined} aria-label={label} aria-current={active ? 'page' : undefined} onClick={onClose} className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${active ? 'bg-[#eff6ff] text-[#2563eb]' : 'text-[#817a74] hover:bg-[#f1f5f9]'} ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}><Icon size={15} strokeWidth={1.8} /><span className={collapsed ? 'lg:hidden' : ''}>{label}</span></Link>;
              })}
            </div>}
          </div>

          <p className={`mb-3 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[#aaa29a] ${collapsed ? 'lg:hidden' : ''}`}>Account</p>
          <div className="flex flex-col gap-1.5">
            {[
              { label: 'Report', icon: FileText, href: '#reports' },
              { label: 'Settings', icon: Settings, href: '#settings' },
            ].map(({ label, icon: Icon, href }) => <Link key={label} href={targetFor(href)} title={collapsed ? label : undefined} aria-label={label} onClick={onClose} className={linkClass(false)}><Icon size={17} strokeWidth={1.8} className="shrink-0" /><span className={collapsed ? 'lg:hidden' : ''}>{label}</span></Link>)}
          </div>
        </nav>

        <div className={`relative mt-5 overflow-hidden rounded-2xl bg-[#eff6ff] p-4 ${collapsed ? 'lg:flex lg:justify-center lg:bg-transparent lg:p-1' : ''}`}>
          <div className={`mb-3 flex size-9 items-center justify-center rounded-xl bg-white text-[#2563eb] ${collapsed ? 'lg:mb-0' : ''}`}><CircleHelp size={19} /></div>
          <div className={collapsed ? 'lg:hidden' : ''}>
            <p className="text-sm font-semibold text-[#342d28]">Upgrade to Pro</p>
            <p className="mt-1 text-[11px] leading-4 text-[#64748b]">Unlock multi-branch analytics for your cafe.</p>
            <button type="button" className="mt-4 w-full rounded-lg bg-[#2563eb] py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#1d4ed8]">Upgrade now</button>
          </div>
        </div>
      </aside>
    </>
  );
}

function ActiveOrdersPanel({ orders, loading, error, onRefresh }: {
  orders: ActiveOrder[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  return (
    <section aria-labelledby="active-orders-heading" className="mx-auto mb-5 max-w-[1450px] px-5 sm:px-8 lg:px-10">
      <div className="rounded-2xl border border-[#dce8fa] bg-white p-4 shadow-[0_2px_12px_rgba(72,45,25,.035)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" /><h2 id="active-orders-heading" className="text-[15px] font-semibold text-[#302a26]">Active Orders</h2><span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-semibold text-[#2563eb]">{orders.length}</span></div>
            <p className="mt-1 text-[11px] text-[#928b84]">Orders stay here until they are completed.</p>
          </div>
          <button type="button" onClick={onRefresh} aria-label="Refresh active orders" className="inline-flex items-center gap-2 rounded-lg border border-[#eee8df] px-3 py-2 text-xs font-medium text-[#6e665f] hover:bg-[#faf7f2]"><RefreshCw size={14} /> Refresh</button>
        </div>

        {loading ? <p className="flex items-center justify-center gap-2 py-7 text-xs text-[#817a74]"><LoaderCircle size={16} className="animate-spin" /> Loading active orders…</p>
          : error && orders.length === 0 ? <p role="alert" className="py-6 text-center text-xs text-red-600">Could not load active orders: {error}</p>
            : orders.length === 0 ? <p className="py-7 text-center text-sm text-[#817a74]">No active orders right now.</p>
              : <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {orders.map((order) => <Link key={order.id} href="/dashboard#orders" className="rounded-xl border border-[#eee8df] bg-[#fdfbf8] p-3.5 transition-colors hover:border-[#bfdbfe] hover:bg-[#f8fbff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-[#302a26]">Order #{order.orderNumber}</p><p className="mt-1 truncate text-[11px] text-[#817a74]" title={order.title}>{order.title}</p></div><span className="shrink-0 rounded-full bg-[#fff0d8] px-2.5 py-1 text-[10px] font-semibold text-[#a96b16]">{formatStatus(order.status)}</span></div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#eee8df] pt-2.5 text-[11px]"><span className="text-[#817a74]">{order.tableNumber ? `Table ${order.tableNumber}` : 'No table assigned'}</span><span className="font-semibold text-[#443b35]">₹{Number(order.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                </Link>)}
              </div>}
        {error && orders.length > 0 && <p role="status" className="mt-3 text-[11px] text-amber-700">Refresh failed; showing the last loaded orders.</p>}
      </div>
    </section>
  );
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapseReady, setCollapseReady] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');

  useEffect(() => {
    setCollapsed(window.localStorage.getItem('dashboard_sidebar_collapsed') === 'true');
    setCollapseReady(true);
  }, []);

  useEffect(() => {
    if (collapseReady) window.localStorage.setItem('dashboard_sidebar_collapsed', String(collapsed));
  }, [collapsed, collapseReady]);

  useEffect(() => {
    setTablesOpen(pathname.startsWith('/dashboard/tables'));
    setMobileOpen(false);
  }, [pathname]);

  const loadActiveOrders = useCallback(async () => {
    if (!user || !activeOrderRoles.includes(user.role)) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }

    setOrdersError('');
    try {
      const branchId = window.localStorage.getItem('active_branch_id');
      const results = await Promise.all(activeStatuses.map((status) => fetchAllOrdersForStatus(branchId, status)));
      setOrders(results.flat().sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()));
    } catch (error) {
      setOrdersError(getErrorMessage(error));
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadActiveOrders();
    const timer = window.setInterval(() => { void loadActiveOrders(); }, refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [loadActiveOrders]);

  const initials = user?.name ? user.name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2) : 'U';

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] text-[#302a26]">
      <div className="flex min-h-screen">
        <Sidebar pathname={pathname} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} collapsed={collapsed} tablesOpen={tablesOpen} onToggleTables={() => setTablesOpen((current) => !current)} />
        <div className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-[#eee8df] bg-[#fffdfa] px-4 sm:px-8 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-lg p-2 text-[#615951] hover:bg-[#f1f5f9] lg:hidden"><Menu size={20} /></button>
              <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden rounded-lg p-2 text-[#615951] hover:bg-[#f1f5f9] lg:inline-flex">{collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}</button>
              <div className="relative hidden w-full max-w-[320px] sm:block">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#aaa29a]" size={16} />
                <input aria-label="Search" placeholder="Search anything..." className="h-10 w-full rounded-xl border border-[#eee8df] bg-[#faf7f2] pl-10 pr-4 text-xs text-[#443b35] outline-none placeholder:text-[#b4ada5] focus:border-[#2563eb]" />
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-5">
              <button type="button" aria-label="Notifications" className="relative text-[#817a74]"><Bell size={19} /><span className="absolute right-0 top-0 size-1.5 rounded-full bg-[#2563eb] ring-2 ring-[#fffdfa]" /></button>
              <div className="flex items-center gap-2 border-l border-[#eee8df] pl-3 sm:gap-3 sm:pl-5">
                <div className="flex size-9 items-center justify-center rounded-full bg-[#3b82f6] text-xs font-semibold text-white">{initials}</div>
                <div className="hidden text-left sm:block"><p className="text-xs font-semibold text-[#443b35]">{user?.name || 'User'}</p><p className="mt-0.5 text-[10px] text-[#aaa29a]">{user?.email || 'authenticated'}</p></div>
                <button type="button" onClick={handleLogout} title="Sign out" className="flex items-center gap-1 rounded-lg border border-[#eee8df] bg-white px-2 py-1 text-[11px] font-medium text-[#ef4444] transition-colors hover:bg-[#fef2f2]"><LogOut size={13} /><span className="hidden md:inline">Logout</span></button>
              </div>
            </div>
          </header>
          <div className="pt-5">
            {user && activeOrderRoles.includes(user.role) && <ActiveOrdersPanel orders={orders.filter((order) => order.status.toUpperCase() !== 'COMPLETED')} loading={ordersLoading} error={ordersError} onRefresh={() => { setOrdersLoading(true); void loadActiveOrders(); }} />}
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
