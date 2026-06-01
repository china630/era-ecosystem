'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { AuthLoginCard, buildAuthLoginLabels, showApiError, assignNoStoreRedirect } from '@era/satellite-kit/ui';
import type { Locale } from '@era/i18n-common';

function LoginForm() {
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const tMeta = useTranslations('meta');
  const locale = useLocale() as Locale;
  const [loginId, setLoginId] = useState('reception');
  const [password, setPassword] = useState('reception123');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t('loginFailed'));
        return;
      }
      const from = searchParams.get('from') || '/';
      assignNoStoreRedirect(from);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLoginCard
      locale={locale}
      labels={{
        ...buildAuthLoginLabels(t),
        loginTitle: tMeta('title'),
        submitLogin: t('signIn'),
        submitBusy: t('signingIn'),
      }}
      loginId={loginId}
      password={password}
      onLoginIdChange={setLoginId}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      busy={busy}
      subtitle={t('signInHint')}
      ssoHint={t('demoHint')}
    />
  );
}

export default function LoginPage() {
  const tc = useTranslations('common');

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#EBEDF0] p-8 text-[#7F8C8D]">{tc('loading')}</div>}>
      <LoginForm />
    </Suspense>
  );
}
