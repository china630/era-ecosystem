'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Preview = {
  businessDate: string;
  wallClockDate: string;
  businessDayStatus: string | null;
  year: number;
  isLastDayOfYear: boolean;
  isFirstDayOfYear: boolean;
  enabled: boolean;
  note: string;
};

export default function NightAuditYearEndPage() {
  const { can } = useAuth();
  const t = useTranslations('nightAudit');
  const tc = useTranslations('common');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/night-audit/year-end');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setPreview(data);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: 'LAST_DAY' | 'FIRST_DAY') {
    setBusy(true);
    try {
      const res = await fetch('/api/night-audit/year-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(data.message ?? t('yearEndStaged'));
      if (data.preview) setPreview(data.preview);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    } finally {
      setBusy(false);
    }
  }

  if (!can(PERMISSIONS.NIGHT_AUDIT_RUN)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  return (
    <>
      <PageHeader title={t('yearEndTitle')} subtitle={t('yearEndSubtitle')} />
      <section className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        {preview ? (
          <ul className="m-0 space-y-1 text-[13px] text-[#34495E]">
            <li>
              {t('businessDate')}: <strong>{preview.businessDate}</strong>
              {preview.businessDayStatus ? ` (${preview.businessDayStatus})` : ''}
            </li>
            <li>
              {t('wallClock')}: {preview.wallClockDate}
            </li>
            <li>
              {t('yearLabel')}: {preview.year}
            </li>
            <li className="text-[#7F8C8D]">{preview.note}</li>
          </ul>
        ) : (
          <p className="m-0 text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !preview}
            onClick={() => void run('LAST_DAY')}
            title={
              preview?.isLastDayOfYear ? undefined : t('lastDayHint')
            }
          >
            {t('lastDayOfYear')}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy || !preview}
            onClick={() => void run('FIRST_DAY')}
            title={
              preview?.isFirstDayOfYear ? undefined : t('firstDayHint')
            }
          >
            {t('firstDayOfYear')}
          </button>
        </div>
        <p className="m-0 text-[12px] text-[#7F8C8D]">{t('yearEndHint')}</p>
      </section>
    </>
  );
}
