'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
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
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = 'pos-bridge-form';

  async function send() {
    setBusy(true);
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
    setMsg(res.ok ? t('roomChargePosted') : data.error);
    if (res.ok) onClose();
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
        {msg && <p className="text-[13px] text-[#7F8C8D]">{msg}</p>}
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="pos-room">
            Room
          </label>
          <input
            id="pos-room"
            className={MODAL_INPUT_CLASS}
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
          />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="pos-amount">
            {tc('amount')}
          </label>
          <input
            id="pos-amount"
            className={MODAL_INPUT_CLASS}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </form>
    </EraModal>
  );
}

function E6Simulator({ onDone }: { onDone: () => void }) {
  const t = useTranslations('integration');
  const tc = useTranslations('common');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [status, setStatus] = useState('accepted');
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setMsg(null);
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
    setMsg(res.ok ? t('e6Applied', { status: data.document?.fiscalStatus }) : data.error ?? tc('failed'));
    if (res.ok) onDone();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input
        placeholder={t('invoiceRefPlaceholder')}
        className={`min-w-[16rem] flex-1 ${MODAL_INPUT_CLASS}`}
        value={invoiceRef}
        onChange={(e) => setInvoiceRef(e.target.value)}
      />
      <select className={MODAL_INPUT_CLASS} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="sent">{t('fiscalSent')}</option>
        <option value="accepted">{t('fiscalAccepted')}</option>
        <option value="rejected">{t('fiscalRejected')}</option>
      </select>
      <button type="button" onClick={send} className={PRIMARY_BUTTON_CLASS}>
        {t('sendE6')}
      </button>
      {msg && <span className="w-full text-[13px] text-[#7F8C8D]">{msg}</span>}
    </div>
  );
}

interface OutboundSettings {
  enabled: boolean;
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
        <input
          className={MODAL_INPUT_CLASS}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
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
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posModalOpen, setPosModalOpen] = useState(false);

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
    setMsg(null);
    try {
      const res = await fetch('/api/hotel/integration-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('saveFailed'));
      setSettings(data);
      setMsg(t('settingsSaved'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tc('error'));
    } finally {
      setBusy(false);
    }
  }

  async function retryFailed() {
    const res = await fetch('/api/integration/retry', { method: 'POST' });
    const data = await res.json();
    setMsg(t('retryQueue', { count: data.sent ?? 0 }));
    await load();
  }

  async function pushMasterData() {
    const res = await fetch('/api/integration/master-data-sync', { method: 'POST' });
    const data = await res.json();
    setMsg(res.ok ? t('e5Sent', { id: data.correlationId }) : data.error);
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
      setMsg(data.error ?? tc('updateFailed'));
      return;
    }
    setMsg(t('glMappingSaved'));
    await load();
  }

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return (
      <AppShell maxWidthClass="max-w-4xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>
      </AppShell>
    );
  }

  if (!settings) {
    return (
      <AppShell maxWidthClass="max-w-4xl">
        <p className="text-[13px] text-[#7F8C8D]">{tc('loading')}</p>
      </AppShell>
    );
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
    <AppShell maxWidthClass="max-w-4xl">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setPosModalOpen(true)}>
            {t('posBridgeTest')}
          </button>
        }
      />
      <StatusMessage>{msg}</StatusMessage>

      <PageSection className="mb-6 space-y-3 text-[13px] text-[#34495E]">
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
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="url-default">
            {t('defaultUrl')}
          </label>
          <input
            id="url-default"
            className={MODAL_INPUT_CLASS}
            value={settings.urls.default}
            onChange={(e) =>
              setSettings((s) => s && { ...s, urls: { ...s.urls, default: e.target.value } })
            }
          />
        </div>
        <div className={FORM_FIELD_GROUP_CLASS}>
          <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="url-na">
            {t('nightAuditUrl')}
          </label>
          <input
            id="url-na"
            className={MODAL_INPUT_CLASS}
            value={settings.urls.nightAudit}
            onChange={(e) =>
              setSettings((s) => s && { ...s, urls: { ...s.urls, nightAudit: e.target.value } })
            }
          />
        </div>
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
      </PageSection>

      <PageSection className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t('e6Title')}</h2>
        <p className="mb-3 text-[13px] text-[#7F8C8D]">{t('e6Hint')}</p>
        <E6Simulator onDone={() => load()} />
      </PageSection>

      <PageSection className="mb-6">
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
      </PageSection>

      <PageSection>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('outboundJournal')}</h2>
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
              {logs.map((l) => (
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
      </PageSection>

      <PosBridgeTestModal open={posModalOpen} onClose={() => setPosModalOpen(false)} />
    </AppShell>
  );
}
