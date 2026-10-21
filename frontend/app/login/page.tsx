'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/auth/AuthContext';
import { getErrorMessage } from '../../src/api/client';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1329] p-4 text-white">
      <div className="w-full max-w-[400px] rounded-2xl border border-[#1e293b] bg-[#111a33] p-8 shadow-2xl">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">Log in to your account</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#94a3b8]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#1e293b] bg-[#0b1329] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#00d2ff]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#94a3b8]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#1e293b] bg-[#0b1329] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#00d2ff]"
              required
            />
          </div>

          {error && <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#00d2ff] py-3 text-sm font-bold text-[#0b1329] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 flex justify-between text-xs text-[#94a3b8]">
          <Link href="/register-restaurant" className="text-[#00d2ff] hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}