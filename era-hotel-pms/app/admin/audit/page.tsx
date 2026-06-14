'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from '@era/satellite-kit/ui';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type AuditRow = {
  id: string;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown>;
  createdAt: string;
};

export default function AuditPage() {
  const { can } = useAuth();
  const t = useTranslations('auditViewer');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entityType, setEntityType] = useState('Reservation');
  const [entityId, setEntityId] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (!entityType.trim()) {
      setMsg(t('entityTypeRequired'));
      return;
    }
    setBusy(true);
    const params = new URLSearchParams({ entityType: entityType.trim() });
    if (entityId.trim()) params.set('entityId', entityId.trim());
    if (action.trim()) params.set('action', action.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const res = await fetch(`/api/audit?${params.toString()}`);
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error ?? t('loadFailed'));
      setRows([]);
      return;
    }
    setMsg(null);
    setRows(Array.isArray(data) ? data : []);
  }, [entityType, entityId, action, dateFrom, dateTo, t]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return (
      <AppShell maxWidthClass="max-w-4xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionReports')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-5xl">
      <PageHeader title={t('title')} />
      <p className="mb-4 text-[13px] text-[#7F8C8D]">{t('subtitle')}</p>

      <PageSection className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#34495E]" htmlFor="audit-entity-type">
              {t('entityType')}
            </label>
            <input
              id="audit-entity-type"
              className={MODAL_INPUT_CLASS}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder={t('entityTypePlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#34495E]" htmlFor="audit-entity-id">
              {t('entityId')}
            </label>
            <input
              id="audit-entity-id"
              className={MODAL_INPUT_CLASS}
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder={t('entityIdPlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#34495E]" htmlFor="audit-action">
              {t('action')}
            </label>
            <input
              id="audit-action"
              className={MODAL_INPUT_CLASS}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder={t('actionPlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#34495E]" htmlFor="audit-date-from">
              {t('dateFrom')}
            </label>
            <input
              id="audit-date-from"
              type="date"
              className={MODAL_INPUT_CLASS}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#34495E]" htmlFor="audit-date-to">
              {t('dateTo')}
            </label>
            <input
              id="audit-date-to"
              type="date"
              className={MODAL_INPUT_CLASS}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          className={`${PRIMARY_BUTTON_CLASS} mt-3`}
          disabled={busy}
          onClick={() => void search()}
        >
          {busy ? tc('loading') : t('search')}
        </button>
      </PageSection>

      <StatusMessage>{msg}</StatusMessage>

      <PageSection>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('date')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('action')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('entityType')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('entityId')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('userId')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('changes')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{new Date(row.createdAt).toLocaleString()}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.action}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.entityType}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.entityId}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.userId ?? tc('dash')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button
                      type="button"
                      className="text-[12px] text-[#2980B9] hover:underline"
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    >
                      {expandedId === row.id ? t('hideChanges') : t('showChanges')}
                    </button>
                    {expandedId === row.id && (
                      <pre className="mt-1 max-h-32 overflow-auto rounded bg-[#F8F9FA] p-2 text-[11px]">
                        {JSON.stringify(row.changes, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={6} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </AppShell>
  );
}
