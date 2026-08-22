'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, PRIMARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function HkPolicyPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const { can } = useAuth();
  const [linen, setLinen] = useState(3);
  const [deep, setDeep] = useState(5);

  const load = useCallback(async () => {
    const res = await fetch('/api/housekeeping/policy');
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, tc('loadError'));
      return;
    }
    setLinen(json.linenEveryNights ?? 3);
    setDeep(json.deepEveryNights ?? 5);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const res = await fetch('/api/housekeeping/policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linenEveryNights: linen, deepEveryNights: deep }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    else showSuccess(tc('saved'));
  }

  return (
    <>
      <PageHeader title={t('policyTitle')} />
      <p className="mb-4 max-w-lg text-sm text-[#7F8C8D]">{t('policyHint')}</p>
      <label className="mb-3 block text-sm">
        {t('linenEvery')}
        <input
          type="number"
          min={1}
          max={30}
          className="ml-2 border px-2 py-1"
          value={linen}
          onChange={(e) => setLinen(Number(e.target.value))}
        />
      </label>
      <label className="mb-4 block text-sm">
        {t('deepEvery')}
        <input
          type="number"
          min={1}
          max={30}
          className="ml-2 border px-2 py-1"
          value={deep}
          onChange={(e) => setDeep(Number(e.target.value))}
        />
      </label>
      {can(PERMISSIONS.HOUSEKEEPING_MANAGE) ? (
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void save()}>
          {tc('save')}
        </button>
      ) : null}
    </>
  );
}
