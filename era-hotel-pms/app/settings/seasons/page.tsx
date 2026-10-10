'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { seasonDateKey } from '@/lib/pricing/price-season';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Season = {
  id: string;
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
};

export default function PriceSeasonsPage() {
  const t = useTranslations('priceSeasons');
  const tc = useTranslations('common');
  const { can } = useAuth();
  const canWrite = can(PERMISSIONS.MASTER_DATA_MANAGE);
  const [rows, setRows] = useState<Season[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/price-seasons');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(
        (Array.isArray(data) ? data : []).map((row: Season) => ({
          ...row,
          startsOn: seasonDateKey(row.startsOn),
          endsOn: seasonDateKey(row.endsOn),
        })),
      );
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(id: string, next: Partial<Season>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  async function save(row: Season) {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/price-seasons/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: row.name,
          startsOn: row.startsOn,
          endsOn: row.endsOn,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('error'));
        return;
      }
      showSuccess(t('saved'));
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('code')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('name')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('startsOn')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('endsOn')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <Field
                      label={t('name')}
                      className="[&_label]:sr-only"
                      preset="shortText"
                      value={row.name}
                      onChange={(e) => patch(row.id, { name: e.target.value })}
                      disabled={!canWrite}
                    />
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <DatePicker
                      label={t('startsOn')}
                      className="[&_label]:sr-only"
                      value={row.startsOn}
                      onChange={(value) => patch(row.id, { startsOn: value })}
                      placeholder={tc('datePlaceholder')}
                      preset="date"
                    />
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <DatePicker
                      label={t('endsOn')}
                      className="[&_label]:sr-only"
                      value={row.endsOn}
                      onChange={(value) => patch(row.id, { endsOn: value })}
                      placeholder={tc('datePlaceholder')}
                      preset="date"
                    />
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {canWrite ? (
                      <button
                        type="button"
                        className={PRIMARY_BUTTON_CLASS}
                        disabled={busyId === row.id}
                        onClick={() => void save(row)}
                      >
                        {tc('save')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
