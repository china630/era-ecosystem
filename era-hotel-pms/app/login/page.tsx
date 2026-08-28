'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { AuthLoginCard, buildAuthLoginLabels, showApiError, assignNoStoreRedirect } from '@era/satellite-kit/ui';
import type { Locale } from '@era/i18n-common';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function LoginForm() {
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const tMeta = useTranslations('meta');
  const locale = useLocale() as Locale;
  const [loginId, setLoginId] = useState('reception');
  const [password, setPassword] = useState('reception123');
  const [organizationId, setOrganizationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [showOrgField, setShowOrgField] = useState(true);

  useEffect(() => {
    const fromQuery = searchParams.get('organizationId')?.trim() ?? '';
    const fromEnv =
      (typeof process !== 'undefined' &&
        (process.env.NEXT_PUBLIC_ERA_SATELLITE_ORGANIZATION_ID ?? '').trim()) ||
      '';
    const bound = fromQuery || fromEnv;
    if (bound && UUID_RE.test(bound)) {
      setOrganizationId(bound);
    }
    // Always show org field — SHARED pool requires it; appliance may prefill from env.
    setShowOrgField(true);
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: { login: string; password: string; organizationId?: string } = {
        login: loginId,
        password,
      };
      const org = organizationId.trim();
      if (org) payload.organizationId = org;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#EBEDF0] p-8">
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
      {showOrgField ? (
        <label className="w-full max-w-md text-sm text-[#2C3E50]">
          <span className="mb-1 block font-medium">{t('organizationIdLabel')}</span>
          <input
            className="w-full rounded border border-[#BDC3C7] bg-white px-3 py-2 font-mono text-sm"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder={t('organizationIdPlaceholder')}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="mt-1 block text-xs text-[#7F8C8D]">{t('organizationIdHint')}</span>
        </label>
      ) : null}
    </div>
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
