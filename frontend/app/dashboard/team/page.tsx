'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LoaderCircle, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '../../../src/auth/AuthContext';
import { api, getErrorMessage } from '../../../src/api/client';

type Branch = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  name: string;
  code: string;
  role: string;
};
type MemberRole = 'BRANCH_MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN_STAFF' | 'INVENTORY_MANAGER' | 'ACCOUNTANT';
type Member = { id: string; name: string; email: string; role: MemberRole };
const roles: MemberRole[] = ['BRANCH_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN_STAFF', 'INVENTORY_MANAGER', 'ACCOUNTANT'];

export default function TeamPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('WAITER');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
        const branch = data.find((item) => item.id === saved) ?? data[0];
        if (branch) setBranchId(branch.id);
      })
      .catch((err) => { if (active) setError(getErrorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, user]);

  const branch = branches.find((item) => item.id === branchId);
  const loadMembers = useCallback(async () => {
    if (!branch) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.get<{ members: Member[] }>('/org/branches/' + encodeURIComponent(branch.id) + '/members');
      setMembers(data.members ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [branch]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branch) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.post('/org/branches/' + encodeURIComponent(branch.id) + '/members', { email: email.trim(), role });
      setEmail('');
      setNotice('Branch role assigned.');
      await loadMembers();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(memberId: string, nextRole: MemberRole) {
    if (!branch) return;
    setError('');
    setNotice('');
    try {
      await api.patch('/org/branches/' + encodeURIComponent(branch.id) + '/members/' + encodeURIComponent(memberId), { role: nextRole });
      setNotice('Branch role updated.');
      await loadMembers();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function removeMember(member: Member) {
    if (!branch || !window.confirm('Remove ' + member.name + ' from ' + branch.name + '?')) return;
    setError('');
    setNotice('');
    try {
      await api.delete('/org/branches/' + encodeURIComponent(branch.id) + '/members/' + encodeURIComponent(member.id));
      setNotice('Branch access removed.');
      await loadMembers();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (authLoading || (loading && branches.length === 0)) {
    return <main className="flex min-h-screen items-center justify-center bg-[#faf7f2] text-sm text-[#817a74]"><LoaderCircle className="mr-2 animate-spin" size={17} /> Loading team access...</main>;
  }
  if (!user) return null;

  const mayAssignManager = branch?.role === 'OWNER';
  return (
    <main className="min-h-screen bg-[#faf7f2] px-5 py-8 text-[#302a26] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href={branch?.role === 'OWNER' ? '/dashboard' : '/dashboard/pos'} className="inline-flex items-center gap-2 text-sm text-[#817a74] hover:text-[#2563eb]"><ArrowLeft size={16} /> {branch?.role === 'OWNER' ? 'Dashboard' : 'POS'}</Link>
        <header className="mb-7 mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#2563eb]">Branch administration</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Team access</h1>
            <p className="mt-2 text-sm text-[#817a74]">Assign a role separately for each branch membership.</p>
          </div>
          {branches.length > 1 && (
            <label className="text-sm font-medium">
              Branch
              <select value={branchId} onChange={(event) => {
                setBranchId(event.target.value);
                setRole('WAITER');
                setMembers([]);
                window.localStorage.setItem('active_branch_id', event.target.value);
              }} className="mt-1 block min-w-56 rounded-xl border border-[#e8e2da] bg-white px-3 py-2.5">
                {branches.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.role.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
          )}
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
        {!branch ? (
          <section className="rounded-2xl border border-dashed border-[#e8e2da] bg-white px-6 py-14 text-center">
            <h2 className="text-lg font-semibold">No branch is available</h2>
            <p className="mt-2 text-sm text-[#817a74]">Create a branch before assigning team access.</p>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <form onSubmit={addMember} className="h-fit rounded-2xl border border-[#e8e2da] bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-2">
                <Plus className="text-[#2563eb]" size={18} />
                <h2 className="font-semibold">Assign branch role</h2>
              </div>
              <label className="mb-4 block text-sm font-medium">
                Team member email
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e8e2da] px-3 py-3 text-sm outline-none focus:border-blue-400" placeholder="name@example.com" />
              </label>
              <label className="mb-3 block text-sm font-medium">
                Role at {branch.name}
                <select value={role} onChange={(event) => setRole(event.target.value as MemberRole)} className="mt-1.5 w-full rounded-xl border border-[#e8e2da] bg-white px-3 py-3 text-sm">
                  {roles.filter((item) => mayAssignManager || item !== 'BRANCH_MANAGER').map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              <p className="mb-4 text-xs leading-5 text-[#817a74]">The team member must already have an account. Their role only applies to this branch.</p>
              <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50">
                {saving ? <><LoaderCircle size={16} className="animate-spin" /> Saving...</> : 'Assign role'}
              </button>
            </form>

            <section className="rounded-2xl border border-[#e8e2da] bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-2">
                <Users className="text-[#2563eb]" size={18} />
                <h2 className="font-semibold">Assigned team</h2>
              </div>
              {loading ? (
                <div className="flex min-h-32 items-center justify-center text-sm text-[#817a74]"><LoaderCircle size={17} className="mr-2 animate-spin" /> Loading members...</div>
              ) : members.length === 0 ? (
                <p className="rounded-xl bg-stone-50 p-5 text-sm text-[#817a74]">No team members are assigned to this branch yet.</p>
              ) : (
                <ul className="divide-y divide-[#eee8df]">
                  {members.map((member) => (
                    <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{member.name}</p>
                        <p className="truncate text-xs text-[#817a74]">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select aria-label={'Role for ' + member.name} value={member.role} onChange={(event) => void changeRole(member.id, event.target.value as MemberRole)} className="max-w-48 rounded-lg border border-[#e8e2da] bg-white px-2.5 py-2 text-xs">
                          {roles.filter((item) => mayAssignManager || item !== 'BRANCH_MANAGER').map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                        </select>
                        <button type="button" onClick={() => void removeMember(member)} aria-label={'Remove ' + member.name} className="rounded-lg p-2 text-[#817a74] hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
