'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getErrorMessage, setAccessToken } from '../../src/api/client';

export default function RegisterRestaurantPage() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleNext(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const fullPhone = phone ? `${countryCode}${phone}` : undefined;
      const { data } = await api.post('/org/onboard', {
        restaurantName,
        fullName,
        email,
        phone: fullPhone,
        password,
      });

      setAccessToken(data.accessToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_restaurant_id', data.restaurant.id);
      }
      router.push('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1329] text-white">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-[#1e293b] px-8">
        <div className="flex items-center gap-2.5 font-bold tracking-wide">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-400 font-extrabold text-white">
            E
          </div>
          <span>EMILY CAFE</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-[#334155] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1e293b]"
          >
            Login
          </Link>
        </div>
      </header>

      {/* 2-Column Split Onboarding */}
      <main className="mx-auto grid max-w-[1200px] flex-1 grid-cols-1 items-center gap-12 px-6 py-10 lg:grid-cols-2">
        <div>
          <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
            Take Control of Your Restaurant
          </h1>
          <ul className="mt-8 space-y-4 text-sm text-[#cbd5e1]">
            <li className="flex items-center gap-3">
              <span className="font-bold text-[#00d2ff]">✓</span>
              Streamline Order & KOT Management
            </li>
            <li className="flex items-center gap-3">
              <span className="font-bold text-[#00d2ff]">✓</span>
              Multi-Branch Tenant Separation
            </li>
            <li className="flex items-center gap-3">
              <span className="font-bold text-[#00d2ff]">✓</span>
              Real-Time Stock & Menu Control
            </li>
          </ul>
        </div>

        {/* Card */}
        <div className="mx-auto w-full max-w-[440px] rounded-2xl border border-[#1e293b] bg-[#111a33] p-8 shadow-2xl">
          <h2 className="text-xl font-bold">Create your cafe account</h2>

          {error && <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{error}</div>}

          <form onSubmit={handleNext} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#94a3b8]">Restaurant Name</label>
              <input
                type="text"
                placeholder="e.g. Emily Cafe Downtown"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#1e293b] bg-[#0b1329] px-3.5 py-2 text-sm text-white outline-none focus:border-[#00d2ff]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8]">Your Full Name</label>
              <input
                type="text"
                placeholder="e.g. Alex Morgan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#1e293b] bg-[#0b1329] px-3.5 py-2 text-sm text-white outline-none focus:border-[#00d2ff]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8]">Enter your email</label>
              <input
                type="email"
                placeholder="alex@emilycafe.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#1e293b] bg-[#0b1329] px-3.5 py-2 text-sm text-white outline-none focus:border-[#00d2ff]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8]">Phone</label>
              <div className="mt-1.5 grid grid-cols-[80px_1fr] gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="rounded-lg border border-[#1e293b] bg-[#0b1329] px-2 py-2 text-xs text-white outline-none focus:border-[#00d2ff]"
                >
                  <option value="+91">+91</option>
                  <option value="+1">+1</option>
                  <option value="+44">+44</option>
                </select>
                <input
                  type="tel"
                  placeholder="1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-lg border border-[#1e293b] bg-[#0b1329] px-3 py-2 text-sm text-white outline-none focus:border-[#00d2ff]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8]">Password</label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#1e293b] bg-[#0b1329] px-3.5 py-2 text-sm text-white outline-none focus:border-[#00d2ff]"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#00d2ff] py-3 text-sm font-bold text-[#0b1329] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Next: Branch Details'}
              </button>
            </div>

            <p className="text-center text-xs text-[#94a3b8]">
              Already registered?{' '}
              <Link href="/login" className="text-[#00d2ff] hover:underline">
                Login here
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}