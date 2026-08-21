'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AgencySsoCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const email = params.get('email');
    const organizationId = params.get('organizationId');
    const agencyId = params.get('agencyId');
    const expiresAt = params.get('expiresAt');
    const signature = params.get('signature');
    const jti = params.get('jti');
    const fullName = params.get('fullName') ?? undefined;
    if (!email || !organizationId || !agencyId || !expiresAt || !signature) {
      setError('Missing SSO parameters');
      return;
    }
    void (async () => {
      const res = await fetch('/api/auth/agency-sso/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          organizationId,
          agencyId,
          expiresAt: Number(expiresAt),
          signature,
          jti: jti ?? undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setError(text || 'Agency SSO failed');
        return;
      }
      router.replace('/agency');
    })();
  }, [params, router]);

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-lg font-semibold">Agency SSO</h1>
        <p className="text-red-600">{error}</p>
      </main>
    );
  }
  return (
    <main className="p-8">
      <p>Signing in…</p>
    </main>
  );
}
