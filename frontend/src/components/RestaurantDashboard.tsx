'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../auth/AuthContext';
import {
  Activity,
  BarChart3,
  Bell,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  Filter,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Search,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Utensils,
  X,
  UtensilsCrossed, // or your preferred table icon
  Layers,
  TableProperties,
  QrCode,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Analytics', icon: BarChart3, href: '#analytics' },
  { label: 'Order', icon: ShoppingBag, href: '#orders' },
  { label: 'Customer', icon: Users, href: '#customers' },
  { label: 'Sales', icon: TrendingUp, href: '#sales' },
  { label: 'Messages', icon: MessageSquare, badge: '12', href: '#messages' },
];

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-[#eee8df] bg-[#fffdfa] px-5 py-7 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-12 flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#3b82f6] text-white">
              <Utensils size={19} />
            </div>
            <span className="text-[19px] font-semibold tracking-tight text-[#2d2925]">
              Emily Cafe
            </span>
          </div>
          <button onClick={onClose} className="text-[#aaa29a] lg:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1">
          <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[#aaa29a]">
            Menu
          </p>
          <div className="flex flex-col gap-1.5">
            {navItems.map(({ label, icon: Icon, badge, href }) => (
              <Link
                key={label}
                href={href}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors ${
                  label === 'Dashboard'
                    ? 'bg-[#eff6ff] text-[#2563eb]'
                    : 'text-[#817a74] hover:bg-[#f1f5f9]'
                }`}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
                {badge && (
                  <span className="ml-auto rounded-full bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          <p className="mb-4 mt-10 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[#aaa29a]">
            Account
          </p>
          <div className="flex flex-col gap-1.5">
            {[
              { label: 'Report', icon: FileText, href: '#reports' },
              { label: 'Settings', icon: Settings, href: '#settings' },
            ].map(({ label, icon: Icon, href }) => (
              <Link
                key={label}
                href={href}
                className="flex h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-[#817a74] hover:bg-[#f1f5f9]"
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="relative overflow-hidden rounded-2xl bg-[#eff6ff] p-4">
          <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-white text-[#2563eb]">
            <CircleHelp size={19} />
          </div>
          <p className="text-sm font-semibold text-[#342d28]">Upgrade to Pro</p>
          <p className="mt-1 text-[11px] leading-4 text-[#64748b]">
            Unlock multi-branch analytics for your cafe.
          </p>
          <button className="mt-4 w-full rounded-lg bg-[#2563eb] py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#1d4ed8]">
            Upgrade now
          </button>
        </div>
      </aside>
    </>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
  badge,
  badgeTone,
}: {
  title: string;
  value: string;
  icon: typeof Box;
  tone: string;
  badge: string;
  badgeTone: string;
}) {
  return (
    <div className="rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_2px_12px_rgba(72,45,25,.025)]">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-[#928b84]">{title}</p>
        <div className={`flex size-9 items-center justify-center rounded-xl ${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-5 text-[25px] font-semibold tracking-[-.03em] text-[#2e2925]">{value}</p>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold">
        <span className={`rounded-md px-1.5 py-1 ${badgeTone}`}>{badge}</span>
      </div>
    </div>
  );
}

function RevenueChart({ monthlyTotals, loading, error }: {
  monthlyTotals: number[];
  loading: boolean;
  error: string;
}) {
  const highestTotal = Math.max(...monthlyTotals, 0);

  return (
    <section className="rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_2px_12px_rgba(72,45,25,.025)] lg:col-span-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[#302a26]">Recorded order totals</h2>
          <p className="mt-1 text-[11px] text-[#aaa29a]">Monthly totals across all order statuses</p>
        </div>
        <button aria-label="Chart settings" className="text-[#aaa29a]">
          <MoreHorizontal size={18} />
        </button>
      </div>
      <div className="mt-7 flex h-[170px] items-end gap-2.5 sm:gap-4">
        {loading ? (
          <p className="mb-8 w-full text-center text-xs text-[#aaa29a]">Loading monthly totals...</p>
        ) : error ? (
          <p role="alert" className="mb-8 w-full text-center text-xs text-red-500">Monthly totals could not be loaded.</p>
        ) : months.map((month, index) => {
          const total = monthlyTotals[index] ?? 0;
          const height = highestTotal > 0 ? (total / highestTotal) * 100 : 0;
          const formattedTotal = total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

          return (
            <div key={month} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${month}: ${formattedTotal}`}>
              <div
                className={`w-full max-w-[18px] rounded-t-md ${
                  total === highestTotal && highestTotal > 0 ? 'bg-[#2563eb]' : 'bg-[#bfdbfe]'
                }`}
                style={{ height: `${height}%` }}
              />
              <span className="text-[9px] text-[#aaa29a]">{month}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Performance() {
  return (
    <section className="rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_2px_12px_rgba(72,45,25,.025)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[#302a26]">Performance</h2>
          <p className="mt-1 text-[11px] text-[#aaa29a]">Interaction overview</p>
        </div>
        <MoreHorizontal size={18} className="text-[#aaa29a]" />
      </div>
      <div className="mt-7 flex h-[145px] items-center justify-center rounded-xl bg-[#f8fafc] px-5 text-center text-xs leading-5 text-[#928b84]">
        Performance data is unavailable because interactions are not recorded yet.
      </div>
    </section>
  );
}
function Station({ stats, loading, error }: {
  stats: DashboardStats | null;
  loading: boolean;
  error: string;
}) {
  return (
    <section className="rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_2px_12px_rgba(72,45,25,.025)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[#302a26]">Station management</h2>
          <p className="mt-1 text-[11px] text-[#aaa29a]">
            More <span className="text-[#2563eb]">&rarr;</span> management features
          </p>
        </div>
        <SlidersHorizontal size={17} className="text-[#aaa29a]" />
      </div>
      <div className="mt-7 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#2563eb] p-3 text-white">
          <strong className="text-xl font-semibold">{loading ? '…' : error ? '—' : stats!.todayOrderCount.toLocaleString()}</strong>
          <p className="mt-1 text-[10px] opacity-75">Today's order</p>
        </div>
        <div className="rounded-xl bg-[#dbeafe] p-3 text-[#1d4ed8]">
          <strong className="text-xl font-semibold">{loading ? '…' : error ? '—' : stats!.todayCompletedOrderCount.toLocaleString()}</strong>
          <p className="mt-1 text-[10px] opacity-75">Completed</p>
        </div>
        <div className="rounded-xl bg-[#f4f0ed] p-3 text-[#8b8179]">
          <strong className="text-xl font-semibold">{loading ? '…' : error ? '—' : stats!.todayPendingOrderCount.toLocaleString()}</strong>
          <p className="mt-1 text-[10px] opacity-75">Pending</p>
        </div>
      </div>
      <div className="mt-8 rounded-lg bg-[#f8fafc] p-3 text-[10px] text-[#928b84]">
        Today's total includes orders in every status.
      </div>
    </section>
  );
}

type RecentOrder = {
  id: string;
  title: string;
  status: string;
  grandTotal: number;
  createdAt: string;
};

type DashboardStats = {
  activeDishCount: number;
  totalOrderCount: number;
  recordedOrderTotal: number;
  todayOrderCount: number;
  todayCompletedOrderCount: number;
  todayPendingOrderCount: number;
  monthlyRecordedOrderTotals: Array<{ month: number; total: number }>;
  profit: null;
};

function formatOrderStatus(status: string) {
  return status.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function RecentOrders({ orders, loading, error }: {
  orders: RecentOrder[];
  loading: boolean;
  error: string;
}) {
  return (
    <section className="rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_2px_12px_rgba(72,45,25,.025)] lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-[#302a26]">Recent order</h2>
        <div className="flex gap-1">
          <button aria-label="Previous order" className="rounded-md border border-[#eee8df] p-1 text-[#aaa29a]">
            <ChevronLeft size={14} />
          </button>
          <button aria-label="Next order" className="rounded-md border border-[#eee8df] p-1 text-[#aaa29a]">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {loading ? (
          <p className="py-4 text-center text-xs text-[#aaa29a]">Loading recent orders...</p>
        ) : error ? (
          <p role="alert" className="py-4 text-center text-xs text-red-500">{error}</p>
        ) : orders.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#aaa29a]">No recent orders yet.</p>
        ) : orders.map((order) => {
          const status = order.status.toUpperCase();
          const statusTone = status === 'COMPLETED'
            ? 'bg-[#e5f4e8] text-[#4b9a67]'
            : status === 'PENDING'
              ? 'bg-[#fff0d8] text-[#be8740]'
              : 'bg-[#f1ebe5] text-[#817a74]';

          return (
            <div key={order.id} className="flex items-center gap-3 rounded-xl bg-[#fdfbf8] p-2.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#eff6ff] text-[#2563eb]">
                <Utensils size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-[#443b35]">{order.title}</p>
                <p className="mt-1 text-[10px] text-[#aaa29a]">
                  {new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-semibold text-[#443b35]">
                  {order.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className={`mt-1 inline-block rounded-md px-1.5 py-1 text-[9px] font-semibold ${statusTone}`}>
                  {formatOrderStatus(order.status)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
export default function RestaurantDashboard() {
  const pathname = usePathname();
  const [tablesOpen, setTablesOpen] = useState(
    pathname?.startsWith('/dashboard/tables') || pathname?.startsWith('/tables') || false
  );
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('Items');
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    let active = true;

    api.get<DashboardStats>('/dashboard/stats')
      .then(({ data }) => {
        if (active) setStats(data);
      })
      .catch((err: unknown) => {
        if (active) setStatsError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setStatsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const branchId = window.localStorage.getItem('active_branch_id');

    api.get<RecentOrder[]>('/orders/recent', {
      params: branchId ? { branchId } : undefined,
    })
      .then(({ data }) => {
        if (active) setOrders(data);
      })
      .catch((err: unknown) => {
        if (active) setOrdersError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const firstName = user?.name ? user.name.split(' ')[0] : 'User';

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] text-[#302a26]">
      <div className="flex min-h-screen">
        <Sidebar open={open} onClose={() => setOpen(false)} />

        <div className="min-w-0 flex-1">
          {/* Header */}
          <header className="flex h-[86px] items-center justify-between border-b border-[#eee8df] bg-[#fffdfa] px-5 sm:px-8 lg:px-10">
            <button
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              className="mr-3 text-[#615951] lg:hidden"
            >
              <BarChart3 size={21} />
            </button>

            <div className="relative hidden w-full max-w-[320px] sm:block">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#aaa29a]"
                size={16}
              />
              <input
                aria-label="Search"
                placeholder="Search anything..."
                className="h-10 w-full rounded-xl border border-[#eee8df] bg-[#faf7f2] pl-10 pr-4 text-xs text-[#443b35] outline-none placeholder:text-[#b4ada5] focus:border-[#2563eb]"
              />
            </div>

            <div className="flex items-center gap-5">
              <button aria-label="Notifications" className="relative text-[#817a74]">
                <Bell size={19} />
                <span className="absolute right-0 top-0 size-1.5 rounded-full bg-[#2563eb] ring-2 ring-[#fffdfa]" />
              </button>

              {/* Dynamic User Profile Badge */}
              <div className="flex items-center gap-3 border-l border-[#eee8df] pl-5">
                <div className="flex size-9 items-center justify-center rounded-full bg-[#3b82f6] text-xs font-semibold text-white">
                  {initials}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-semibold text-[#443b35]">
                    {user?.name || 'User'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#aaa29a]">
                    {user?.email || 'authenticated'}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="flex items-center gap-1 rounded-lg border border-[#eee8df] bg-white px-2 py-1 text-[11px] font-medium text-[#ef4444] transition-colors hover:bg-[#fef2f2]"
                >
                  <LogOut size={13} />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </div>
            </div>
          </header>

          {/* Main Dashboard Content */}
          <div className="mx-auto max-w-[1450px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[.16em] text-[#2563eb]">
                  Good morning, {firstName}
                </p>
                <h1 className="text-[30px] font-semibold tracking-[-.04em] text-[#302a26]">
                  My dashboard
                </h1>
                <p className="mt-2 text-xs text-[#928b84]">
                  Your recent transaction activity and all insights.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex h-10 items-center gap-2 rounded-xl border border-[#eee8df] bg-white px-3.5 text-xs font-medium text-[#6e665f]">
                  <span>Today</span>
                  <ChevronDown size={14} />
                </button>
                <button className="flex h-10 items-center gap-2 rounded-xl bg-[#2563eb] px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1d4ed8]">
                  <Filter size={14} />
                  Filter
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-7 flex items-center justify-between border-b border-[#eee8df]">
              <div className="flex gap-6">
                {['Items', 'Customer'].map((item) => (
                  <button
                    key={item}
                    onClick={() => setTab(item)}
                    className={`relative pb-3 text-xs font-semibold ${
                      tab === item ? 'text-[#2563eb]' : 'text-[#aaa29a]'
                    }`}
                  >
                    {item}
                    {tab === item && (
                      <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-[#2563eb]" />
                    )}
                  </button>
                ))}
              </div>
              <span className="hidden text-[10px] text-[#aaa29a] sm:block">
                Role: <strong>{user?.role || 'USER'}</strong>
              </span>
            </div>

            {/* Stat Cards */}
            {statsError && (
              <p role="alert" className="mt-4 text-xs text-red-500">
                Dashboard statistics could not be loaded: {statsError}
              </p>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Available dishes"
                value={statsLoading ? 'Loading…' : statsError ? '—' : stats!.activeDishCount.toLocaleString()}
                icon={Utensils}
                tone="bg-[#fff0e8] text-[#2563eb]"
                badge="Active items"
                badgeTone="bg-[#fff0e8] text-[#2563eb]"
              />
              <StatCard
                title="Total order"
                value={statsLoading ? 'Loading…' : statsError ? '—' : stats!.totalOrderCount.toLocaleString()}
                icon={Box}
                tone="bg-[#f0eafa] text-[#8f70c1]"
                badge="All statuses"
                badgeTone="bg-[#f0eafa] text-[#8f70c1]"
              />
              <StatCard
                title="Recorded order total"
                value={statsLoading
                  ? 'Loading…'
                  : statsError
                    ? '—'
                    : stats!.recordedOrderTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                icon={Activity}
                tone="bg-[#eaf3fb] text-[#659bc7]"
                badge="Recorded totals"
                badgeTone="bg-[#eaf3fb] text-[#659bc7]"
              />
              <StatCard
                title="Total profit"
                value="N/A"
                icon={TrendingUp}
                tone="bg-[#e8f5eb] text-[#66a77a]"
                badge="Cost data unavailable"
                badgeTone="bg-[#e8f5eb] text-[#66a77a]"
              />
            </div>

            {/* Mid Grid */}
            <div className="mt-4 grid gap-4 xl:grid-cols-4">
              <RevenueChart
                monthlyTotals={stats?.monthlyRecordedOrderTotals.map(({ total }) => total) ?? []}
                loading={statsLoading}
                error={statsError}
              />
              <Performance />
              <Station stats={stats} loading={statsLoading} error={statsError} />
            </div>

            {/* Bottom Grid */}
            <div className="mt-4 grid gap-4 xl:grid-cols-4">
              <section id="reports" className="rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_2px_12px_rgba(72,45,25,.025)]">
                <h2 className="text-[15px] font-semibold text-[#302a26]">Reports</h2>
                <div className="mt-5 rounded-xl bg-[#f8fafc] p-4 text-xs leading-5 text-[#928b84]">
                  No reports have been generated yet. Report creation and downloads are not available yet.
                </div>
              </section>

              <section id="customers" className="rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_2px_12px_rgba(72,45,25,.025)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[#302a26]">Customers</h2>
                    <p className="mt-1 text-[11px] text-[#aaa29a]">Customer source breakdown</p>
                  </div>
                  <MoreHorizontal size={18} className="text-[#aaa29a]" />
                </div>
                <div className="mt-5 flex min-h-[112px] items-center justify-center rounded-xl bg-[#f8fafc] px-5 text-center text-xs leading-5 text-[#928b84]">
                  Customer profiles and order source are not recorded in the current data model.
                </div>
              </section>
              <RecentOrders orders={orders} loading={ordersLoading} error={ordersError} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
