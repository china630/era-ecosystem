'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';

interface Role {
  id: string;
  code: string;
  name: string;
}

interface UserRow {
  id: string;
  login: string;
  fullName: string;
  role: string;
  status: string;
}

export default function AdminUsersPage() {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const tAuth = useTranslations('auth');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState(false);

  const load = useCallback(async () => {
    const [uRes, rRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/roles'),
    ]);
    if (uRes.ok) setUsers(await uRes.json());
    if (rRes.ok) {
      const r = await rRes.json();
      setRoles(r);
      setRoleId((prev) => prev || r[0]?.id || '');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setQuotaError(false);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, fullName, password, roleId }),
    });
    const data = await res.json();
    if (res.status === 403) {
      setQuotaError(true);
      setMsg(data.error ?? t('seatQuotaExceeded'));
      return;
    }
    if (!res.ok) {
      setMsg(data.error ?? tc('failed'));
      return;
    }
    setMsg(t('userCreated', { login: data.login }));
    setLogin('');
    setFullName('');
    setPassword('');
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AppNav />
      <h1 className="mb-4 text-xl font-semibold">{t('title')}</h1>

      {quotaError && (
        <div className="mb-4 rounded-lg border border-rose-600 bg-rose-950/50 p-4 text-sm text-rose-200">
          {t('quotaExceeded')}
        </div>
      )}

      <form
        onSubmit={createUser}
        className="mb-8 grid gap-3 rounded-xl border border-slate-700 p-4 sm:grid-cols-2"
      >
        <input
          placeholder={tAuth('login')}
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
        />
        <input
          placeholder={t('fullName')}
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={tAuth('password')}
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="sm:col-span-2 rounded-lg bg-sky-700 py-2 text-sm font-medium hover:bg-sky-600"
        >
          {t('createUser')}
        </button>
      </form>

      {msg && <p className="mb-4 text-sm text-slate-300">{msg}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-slate-500">
            <th className="py-2">{tAuth('login')}</th>
            <th>{tc('name')}</th>
            <th>{t('role')}</th>
            <th>{tc('status')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-slate-800">
              <td className="py-2">{u.login}</td>
              <td>{u.fullName}</td>
              <td>{u.role}</td>
              <td>{u.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
