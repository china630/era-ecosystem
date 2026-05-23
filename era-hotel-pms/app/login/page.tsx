'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const tMeta = useTranslations('meta');
  const tCommon = useTranslations('common');
  const [login, setLogin] = useState('reception');
  const [password, setPassword] = useState('reception123');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('loginFailed'));
      const from = searchParams.get('from') || '/';
      router.push(from);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="mb-4 flex justify-end">
        <LanguageSwitcher />
      </div>
      <h1 className="mb-2 text-2xl font-semibold">{tMeta('title')}</h1>
      <p className="mb-6 text-sm text-slate-400">{t('signInHint')}</p>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-6">
        <label className="block text-sm">
          {t('login')}
          <input
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block text-sm">
          {t('password')}
          <input
            type="password"
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-sky-700 py-2 font-medium hover:bg-sky-600 disabled:opacity-50"
        >
          {busy ? t('signingIn') : t('signIn')}
        </button>
      </form>

      <p className="mt-4 text-xs text-slate-500">{t('demoHint')}</p>
    </div>
  );
}

export default function LoginPage() {
  const tCommon = useTranslations('common');

  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">{tCommon('loading')}</div>}>
      <LoginForm />
    </Suspense>
  );
}
