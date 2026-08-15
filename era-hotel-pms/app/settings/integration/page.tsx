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
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  PageHeader,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

function PosBridgeTestModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('integration');
  const tc = useTranslations('common');
  const [roomNumber, setRoomNumber] = useState('201');
  const [amount, setAmount] = useState('15');
  const [busy, setBusy] = useState(false);
  const formId = 'pos-bridge-form';

  async function send() {
    setBusy(true);
    try {
      const res = await fetch('/api/pos/room-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNumber,
          revenueCode: 'FOOD',
          amount: parseFloat(amount),
          description: t('posBridgeDescription'),
          outletCode: 'RESTAURANT',
        }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(t('roomChargePosted'));
      onClose();
    } catch (e) {
      setBusy(false);
      showApiError({ error: e instanceof Error ? e.message : tc('failed') });
    }
  }

  return (
    <EraModal
      open={open}
      title={t('posBridgeTest')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          onSubmit={send}
          busy={busy}
          submitLabel={t('roomChargeFood')}
        />
      }
    >
      <form id={formId} className={FORM_STACK_CLASS} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <Field label="Room" preset="code" id="pos-room" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
        <Field label={tc('amount')} preset="amount" id="pos-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </form>
    </EraModal>
  );
}

function E6SimulatorModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('integration');
  const tc = useTranslations('common');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [status, setStatus] = useState('accepted');
  const [busy, setBusy] = useState(false);
  const formId = 'e6-simulator-form';

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/integration/erp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceRef,
          fiscalStatus: status,
          fiscalExternalId: status === 'accepted' ? `EQ-${Date.now()}` : undefined,
          rejectionReason: status === 'rejected' ? t('rejectionDemo') : undefined,
        }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(t('e6Applied', { status: data.document?.fiscalStatus }));
      onDone();
      onClose();
    } catch (err) {
      setBusy(false);
      showApiError({ error: err instanceof Error ? err.message : tc('failed') });
    }
  }

  return (
    <EraModal
      open={open}
      title={t('e6Title')}
      onClose={onClose}
      footer={
        <EraModalFooter
          formId={formId}
          onCancel={onClose}
          busy={busy}
          submitLabel={t('sendE6')}
        />
      }
    >
      <form id={formId} onSubmit={send} className={FORM_STACK_CLASS}>
        <Field
          label={t('invoiceRefPlaceholder')}
          preset="code"
          id="e6-invoice"
          placeholder={t('invoiceRefPlaceholder')}
          value={invoiceRef}
          onChange={(e) => setInvoiceRef(e.target.value)}
        />
        <FieldSelect label={tc('status')} preset="select" id="e6-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="sent">{t('fiscalSent')}</option>
          <option value="accepted">{t('fiscalAccepted')}</option>
          <option value="rejected">{t('fiscalRejected')}</option>
        </FieldSelect>
      </form>
    </EraModal>
  );
}

interface OutboundSettings {
  enabled: boolean;
  platformSubscription?: Record<string, unknown> | null;
  realtime: {
    chargePosted: boolean;
    paymentReceived: boolean;
    chargeVoided: boolean;
    reservationCompleted: boolean;
    invoiceIssued: boolean;
    paymentFiscalized: boolean;
  };
  cityLedgerSnapshot: boolean;
  masterDataSync: boolean;
  nightAuditClosed: boolean;
  urls: { default: string; nightAudit: string };
  requireZeroBalanceOnCheckout: boolean;
}

interface OutboundLog {
  id: string;
  eventType: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

interface GlMapping {
  id: string;
  glAccountCode: string;
  revenueCode: { id: string; code: string; name: string };
}

function GlMappingRow({
  mapping,
  onSave,
}: {
  mapping: GlMapping;
  onSave: (revenueCodeId: string, glAccountCode: string) => Promise<void>;
}) {
  const tc = useTranslations('common');
  const [code, setCode] = useState(mapping.glAccountCode);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCode(mapping.glAccountCode);
  }, [mapping.glAccountCode]);

  return (
    <tr className={DATA_TABLE_TR_CLASS}>
      <td className={DATA_TABLE_TD_CLASS}>
        {mapping.revenueCode.code} — {mapping.revenueCode.name}
      </td>
      <td className={DATA_TABLE_TD_CLASS}>
        <Field label={tc('code')} preset="code" value={code} onChange={(e) => setCode(e.target.value)} />
      </td>
      <td className={DATA_TABLE_TD_CLASS}>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy || code === mapping.glAccountCode}
          onClick={async () => {
            setBusy(true);
            await onSave(mapping.revenueCode.id, code);
            setBusy(false);
          }}
        >
          {tc('save')}
        </button>
      </td>
    </tr>
  );
}

const REALTIME_EVENT_KEYS = {
  chargePosted: 'eventChargePosted',
  paymentReceived: 'eventPaymentReceived',
  chargeVoided: 'eventChargeVoided',
  reservationCompleted: 'eventReservationCompleted',
  invoiceIssued: 'eventInvoiceIssued',
  paymentFiscalized: 'eventPaymentFiscalized',
} as const;

export default function IntegrationAdminPage() {
  const { can } = useAuth();
  const t = useTranslations('integration');
  const tc = useTranslations('common');
  const [settings, setSettings] = useState<OutboundSettings | null>(null);
  const [logs, setLogs] = useState<OutboundLog[]>([]);
  const [glMappings, setGlMappings] = useState<GlMapping[]>([]);
  const [busy, setBusy] = useState(false);
  const [logQ, setLogQ] = useState('');
  const debouncedLogQ = useDebouncedValue(logQ, 300);
  const [posModalOpen, setPosModalOpen] = useState(false);
  const [e6ModalOpen, setE6ModalOpen] = useState(false);

  const load = useCallback(async () => {
    const [sRes, lRes, glRes] = await Promise.all([
      fetch('/api/hotel/integration-settings'),
      fetch('/api/integration/outbound-log?limit=50'),
      fetch('/api/master/revenue-gl-mappings'),
    ]);
    if (sRes.ok) setSettings(await sRes.json());
    if (lRes.ok) setLogs(await lRes.json());
    if (glRes.ok) setGlMappings(await glRes.json());
  }, []);

  useEffect(() => {
    if (can(PERMISSIONS.MASTER_DATA_MANAGE)) load();
  }, [load, can]);

  async function save() {
    if (!settings) return;
    setBusy(true);
    try {
      const res = await fetch('/api/hotel/integration-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('saveFailed'));
      setSettings(data);
      showSuccess(t('settingsSaved'));
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('error') });
    } finally {
      setBusy(false);
    }
  }

  async function retryFailed() {
    const res = await fetch('/api/integration/retry', { method: 'POST' });
    const data = await res.json();
    showSuccess(t('retryQueue', { count: data.sent ?? 0 }));
    await load();
  }

  async function pushMasterData() {
    const res = await fetch('/api/integration/master-data-sync', { method: 'POST' });
    const data = await res.json();
    if (res.ok) showSuccess(t('e5Sent', { id: data.correlationId }));
    else showApiError(data, tc('failed'));
    await load();
  }

  async function saveGlMapping(revenueCodeId: string, glAccountCode: string) {
    const res = await fetch('/api/master/revenue-gl-mappings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revenueCodeId, glAccountCode }),
    });
    if (!res.ok) {
      const data = await res.json();
      showApiError(data, tc('updateFailed'));
      return;
    }
    showSuccess(t('glMappingSaved'));
    await load();
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  if (!settings) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>;
  }

  const toggle = (path: string, value: boolean) => {
    setSettings((s) => {
      if (!s) return s;
      const next = { ...s, realtime: { ...s.realtime }, urls: { ...s.urls } };
      if (path === 'enabled') next.enabled = value;
      else if (path === 'nightAuditClosed') next.nightAuditClosed = value;
      else if (path === 'requireZeroBalanceOnCheckout') next.requireZeroBalanceOnCheckout = value;
      else if (path === 'chargePosted') next.realtime.chargePosted = value;
      else if (path === 'paymentReceived') next.realtime.paymentReceived = value;
      else if (path === 'chargeVoided') next.realtime.chargeVoided = value;
      else if (path === 'reservationCompleted') next.realtime.reservationCompleted = value;
      else if (path === 'invoiceIssued') next.realtime.invoiceIssued = value;
      else if (path === 'paymentFiscalized') next.realtime.paymentFiscalized = value;
      else if (path === 'cityLedgerSnapshot') next.cityLedgerSnapshot = value;
      else if (path === 'masterDataSync') next.masterDataSync = value;
      return next;
    });
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setPosModalOpen(true)}>
            {t('posBridgeTest')}
          </button>
        }
      />
      {settings.platformSubscription != null && (
        <section className={`${CARD_CONTAINER_CLASS} mb-6 border border-dashed border-[#CBD2D9] bg-[#F4F6F8] p-4 text-[13px] text-[#34495E]`}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
              {t('platformSubscription')}
            </p>
            <span className="rounded bg-[#E8ECF0] px-2 py-0.5 text-[11px] font-medium text-[#5D6D7E]">
              {t('platformSubscriptionReadonlyBadge')}
            </span>
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-[#7F8C8D]">
            {t('platformSubscriptionHint')}
          </p>
          <pre
            className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-[#E5E8EB] bg-white/70 p-3 text-[11px] text-[#5D6D7E]"
            aria-label={t('platformSubscription')}
          >
            {JSON.stringify(settings.platformSubscription, null, 2)}
          </pre>
        </section>
      )}

      <section className={`${CARD_CONTAINER_CLASS} mb-6 space-y-3 p-4 text-[13px] text-[#34495E]`}>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className={MODAL_CHECKBOX_CLASS}
            checked={settings.enabled}
            onChange={(e) => toggle('enabled', e.target.checked)}
          />
          {t('globalEnabled')}
        </label>
        <p className="text-xs font-semibold uppercase text-[#7F8C8D]">{t('realtimeFolio')}</p>
        {(Object.keys(REALTIME_EVENT_KEYS) as (keyof typeof REALTIME_EVENT_KEYS)[]).map((key) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              checked={settings.realtime[key]}
              onChange={(e) => toggle(key, e.target.checked)}
            />
            {t(REALTIME_EVENT_KEYS[key])}
          </label>
        ))}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className={MODAL_CHECKBOX_CLASS}
            checked={settings.cityLedgerSnapshot}
            onChange={(e) => toggle('cityLedgerSnapshot', e.target.checked)}
          />
          {t('eventCityLedger')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className={MODAL_CHECKBOX_CLASS}
            checked={settings.masterDataSync}
            onChange={(e) => toggle('masterDataSync', e.target.checked)}
          />
          {t('eventMasterData')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className={MODAL_CHECKBOX_CLASS}
            checked={settings.nightAuditClosed}
            onChange={(e) => toggle('nightAuditClosed', e.target.checked)}
          />
          {t('eventNightAudit')}
        </label>
        <Field
          label={t('defaultUrl')}
          preset="longText"
          id="url-default"
          value={settings.urls.default}
          onChange={(e) =>
            setSettings((s) => s && { ...s, urls: { ...s.urls, default: e.target.value } })
          }
        />
        <Field
          label={t('nightAuditUrl')}
          preset="longText"
          id="url-na"
          value={settings.urls.nightAudit}
          onChange={(e) =>
            setSettings((s) => s && { ...s, urls: { ...s.urls, nightAudit: e.target.value } })
          }
        />
        <div className="flex flex-wrap gap-2 pt-2">
          <button type="button" disabled={busy} onClick={save} className={PRIMARY_BUTTON_CLASS}>
            {tc('save')}
          </button>
          <button type="button" onClick={retryFailed} className={SECONDARY_BUTTON_CLASS}>
            {t('processRetry')}
          </button>
          <button type="button" onClick={pushMasterData} className={SECONDARY_BUTTON_CLASS}>
            {t('pushMasterData')}
          </button>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} mb-6 p-4`}>
        <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t('e6Title')}</h2>
        <p className="mb-3 text-[13px] text-[#7F8C8D]">{t('e6Hint')}</p>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setE6ModalOpen(true)}>
          {t('sendE6')}
        </button>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} mb-6 p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('glMappingTitle')}</h2>
        <p className="mb-3 text-[13px] text-[#7F8C8D]">{t('glMappingHint')}</p>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('revenueCode')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('glAccount')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {glMappings.map((m) => (
                <GlMappingRow key={m.id} mapping={m} onSave={saveGlMapping} />
              ))}
              {glMappings.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={3} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('noGlMappings')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('outboundJournal')}</h2>
        <EraListFilterBar
          resetLabel={tc('filterReset')}
          className="mb-3"
          onReset={() => setLogQ('')}
        >
          <Field
            label={tc('search')}
            preset="longText"
            value={logQ}
            onChange={(e) => setLogQ(e.target.value)}
          />
        </EraListFilterBar>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('time')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>Event</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('attempts')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('error')}</th>
              </tr>
            </thead>
            <tbody>
              {logs
              .filter((l) => {
                const q = debouncedLogQ.trim().toLowerCase();
                if (!q) return true;
                return (
                  l.eventType.toLowerCase().includes(q) ||
                  l.status.toLowerCase().includes(q) ||
                  (l.lastError ?? '').toLowerCase().includes(q)
                );
              })
              .map((l) => (
                <tr key={l.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{new Date(l.createdAt).toLocaleString()}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} max-w-[10rem] truncate`}>
                    {l.eventType.replace('SATELLITE_HOTEL_', '')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{l.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{l.attempts}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} max-w-[12rem] truncate text-rose-600`}>
                    {l.lastError ?? tc('dash')}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('noEvents')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PosBridgeTestModal open={posModalOpen} onClose={() => setPosModalOpen(false)} />
      <E6SimulatorModal open={e6ModalOpen} onClose={() => setE6ModalOpen(false)} onDone={() => load()} />
    </>
  );
}
