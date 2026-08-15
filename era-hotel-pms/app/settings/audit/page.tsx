'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  PageHeader,
  showApiError,
} from '@era/satellite-kit/ui';
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
  const [busy, setBusy] = useState(false);
  const [entityType, setEntityType] = useState('Reservation');
  const [entityId, setEntityId] = useState('');
  const [action, setAction] = useState('');
  const debouncedEntityId = useDebouncedValue(entityId, 300);
  const debouncedAction = useDebouncedValue(action, 300);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (!entityType.trim()) {
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({ entityType: entityType.trim() });
      if (debouncedEntityId.trim()) params.set('entityId', debouncedEntityId.trim());
      if (debouncedAction.trim()) params.set('action', debouncedAction.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/audit?${params.toString()}`);
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        showApiError(data, t('loadFailed'));
        setRows([]);
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setBusy(false);
      showApiError({ error: e instanceof Error ? e.message : t('loadFailed') });
    }
  }, [entityType, debouncedEntityId, debouncedAction, dateFrom, dateTo, t]);

  useEffect(() => {
    if (!entityType.trim()) return;
    void search();
  }, [entityType, debouncedEntityId, debouncedAction, dateFrom, dateTo, search]);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionReports')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} />
      <p className="mb-4 text-[13px] text-[#7F8C8D]">{t('subtitle')}</p>

      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setEntityType('Reservation');
          setEntityId('');
          setAction('');
          setDateFrom('');
          setDateTo('');
          setRows([]);
        }}
      >
        <Field
          label={t('entityType')}
          preset="shortText"
          id="audit-entity-type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          placeholder={t('entityTypePlaceholder')}
        />
        <Field
          label={t('entityId')}
          preset="code"
          id="audit-entity-id"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          placeholder={t('entityIdPlaceholder')}
        />
        <Field
          label={t('action')}
          preset="shortText"
          id="audit-action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder={t('actionPlaceholder')}
        />
        <DatePicker
          label={t('dateFrom')}
          value={dateFrom}
          onChange={setDateFrom}
          placeholder={tc('datePlaceholder')}
          preset="date"
          id="audit-date-from"
        />
        <DatePicker
          label={t('dateTo')}
          value={dateTo}
          onChange={setDateTo}
          placeholder={tc('datePlaceholder')}
          preset="date"
          id="audit-date-to"
        />
      </EraListFilterBar>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
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
      </section>
    </>
  );
}
