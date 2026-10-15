'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDateKey } from '@/lib/hotel-calendar';

type NightAuditRunRow = {
  id: string;
  status: string;
  stepsJson: string | null;
  errorsJson: string | null;
  completedAt: string | null;
  createdAt: string;
  businessDay: { date: string; status: string };
};

function parseJsonList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [raw];
    return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
  } catch {
    return [raw];
  }
}

export default function NightAuditLogsPage() {
  const { can, loading } = useAuth();
  const t = useTranslations('nightAudit');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<NightAuditRunRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/night-audit/runs?limit=100');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc('loadError'));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    if (loading) return;
    if (!can(PERMISSIONS.SCREEN_NIGHT_AUDIT) && !can(PERMISSIONS.NIGHT_AUDIT_RUN)) return;
    void load();
  }, [loading, can, load]);

  if (loading) return null;
  if (!can(PERMISSIONS.SCREEN_NIGHT_AUDIT) && !can(PERMISSIONS.NIGHT_AUDIT_RUN)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  function statusLabel(status: string) {
    if (status === 'COMPLETED') return t('statusCompleted');
    if (status === 'FAILED') return t('statusFailed');
    if (status === 'RUNNING') return t('statusRunning');
    return status;
  }

  return (
    <>
      <PageHeader title={t('logsTitle')} subtitle={t('logsSubtitle')} />
      <section className={`${CARD_CONTAINER_CLASS} p-0`}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colBusinessDate')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colRunStatus')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colStarted')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colFinished')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colSteps')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('colErrors')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                    {t('logsEmpty')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const steps = parseJsonList(row.stepsJson);
                  const errors = parseJsonList(row.errorsJson);
                  const open = openId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`${DATA_TABLE_TR_CLASS} cursor-pointer`}
                        onClick={() => setOpenId(open ? null : row.id)}
                      >
                        <td className={DATA_TABLE_TD_CLASS}>{hotelDateKey(row.businessDay.date)}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{statusLabel(row.status)}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{bakuDateTimeDisplay(row.createdAt)}</td>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {row.completedAt ? bakuDateTimeDisplay(row.completedAt) : '—'}
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>{steps.length}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{errors.length}</td>
                      </tr>
                      {open ? (
                        <tr key={`${row.id}-detail`} className={DATA_TABLE_TR_CLASS}>
                          <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                            <div className="space-y-2 text-[13px]">
                              <div>
                                <p className="m-0 font-medium">{t('colSteps')}</p>
                                {steps.length === 0 ? (
                                  <p className="m-0 text-[#7F8C8D]">—</p>
                                ) : (
                                  <ul className="m-0 list-disc pl-5">
                                    {steps.map((step, index) => (
                                      <li key={`${row.id}-step-${index}`}>{step}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div>
                                <p className="m-0 font-medium">{t('colErrors')}</p>
                                {errors.length === 0 ? (
                                  <p className="m-0 text-[#7F8C8D]">—</p>
                                ) : (
                                  <ul className="m-0 list-disc pl-5">
                                    {errors.map((error, index) => (
                                      <li key={`${row.id}-err-${index}`}>{error}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
