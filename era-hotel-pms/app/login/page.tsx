'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  APP_SHELL_CLASS,
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import LanguageSwitcher from '@/components/LanguageSwitcher';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const tMeta = useTranslations('meta');
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
    <div className={`${APP_SHELL_CLASS} flex min-h-screen flex-col`}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-[#34495E]">{tMeta('title')}</h1>
        <p className="mb-6 text-[13px] text-[#7F8C8D]">{t('signInHint')}</p>

        <form onSubmit={submit} className={`${CARD_CONTAINER_CLASS} ${FORM_STACK_CLASS} p-6`}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="login-user">
              {t('login')}
            </label>
            <input
              id="login-user"
              className={MODAL_INPUT_CLASS}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="login-password">
              {t('password')}
            </label>
            <input
              id="login-password"
              type="password"
              className={MODAL_INPUT_CLASS}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-[13px] text-rose-600">{error}</p>}
          <button type="submit" disabled={busy} className={`w-full ${PRIMARY_BUTTON_CLASS} !h-9 !min-h-9`}>
            {busy ? t('signingIn') : t('signIn')}
          </button>
        </form>

        <p className="mt-4 text-xs text-[#7F8C8D]">{t('demoHint')}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const tc = useTranslations('common');

  return (
    <Suspense fallback={<div className={`${APP_SHELL_CLASS} p-8 text-center text-[#7F8C8D]`}>{tc('loading')}</div>}>
      <LoginForm />
    </Suspense>
  );
}
