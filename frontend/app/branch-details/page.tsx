'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getErrorMessage } from '../../src/api/client';

export default function BranchDetailsPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('active_restaurant_id')) router.replace('/register-restaurant');
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const restaurantId = localStorage.getItem('active_restaurant_id');
      if (!restaurantId) {
        router.replace('/register-restaurant');
        return;
      }
      const { data: branch } = await api.post<{ id: string }>('/org/branches', { restaurantId, code, name, address: address || undefined });
      localStorage.setItem('active_branch_id', branch.id);
      router.push('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1329] p-6 text-white">
      <section className="w-full max-w-lg rounded-2xl border border-[#1e293b] bg-[#111a33] p-8 shadow-2xl">
        <Link href="/register-restaurant" className="text-xs text-[#00d2ff] hover:underline">
          Emily Cafe
        </Link>
        <h1 className="mt-5 text-2xl font-bold">Add your first branch</h1>
        <p className="mt-2 text-sm text-[#94a3b8]">Enter the details for your restaurant location.</p>

        {error && <div className="mt-5 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{error}</div>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-xs font-medium text-[#94a3b8]">
            Branch name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Downtown"
              className="mt-1.5 w-full rounded-lg border border-[#1e293b] bg-[#0b1329] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#00d2ff]"
              required
              minLength={2}
              maxLength={160}
            />
          </label>
          <label className="block text-xs font-medium text-[#94a3b8]">
            Branch code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="e.g. DT01"
              className="mt-1.5 w-full rounded-lg border border-[#1e293b] bg-[#0b1329] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#00d2ff]"
              required
              minLength={2}
              maxLength={40}
            />
          </label>
          <label className="block text-xs font-medium text-[#94a3b8]">
            Address <span className="font-normal">(optional)</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Street, city"
              className="mt-1.5 w-full rounded-lg border border-[#1e293b] bg-[#0b1329] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#00d2ff]"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#00d2ff] py-3 text-sm font-bold text-[#0b1329] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Saving branch...' : 'Continue to Dashboard'}
          </button>
        </form>
      </section>
    </main>
  );
}
