'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

function PosBridgeTest() {
  const t = useTranslations('integration');
  const [roomNumber, setRoomNumber] = useState('201');
  const [amount, setAmount] = useState('15');
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
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
    setMsg(res.ok ? t('roomChargePosted') : data.error);
  }

  return (
    <section className="mb-8 rounded-xl border border-slate-700 p-4">
      <h2 className="mb-2 text-sm font-medium uppercase text-slate-500">{t('posBridgeTest')}</h2>
      <div className="flex flex-wrap gap-2 text-sm">
        <input
          className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1"
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
        />
        <input
          className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button type="button" onClick={send} className="rounded bg-emerald-800 px-3 py-1 text-xs">
          {t('roomChargeFood')}
        </button>
        {msg && <span className="text-xs text-slate-400">{msg}</span>}
      </div>
    </section>
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
    <div className="flex flex-wrap gap-2 text-sm">
      <input
        placeholder={t('invoiceRefPlaceholder')}
        className="min-w-[16rem] flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs"
        value={invoiceRef}
        onChange={(e) => setInvoiceRef(e.target.value)}
      />
      <select
        className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="sent">{t('fiscalSent')}</option>
        <option value="accepted">{t('fiscalAccepted')}</option>
        <option value="rejected">{t('fiscalRejected')}</option>
      </select>
      <button type="button" onClick={send} className="rounded bg-indigo-700 px-3 py-1 text-xs">
        {t('sendE6')}
      </button>
      {msg && <span className="w-full text-xs text-slate-400">{msg}</span>}
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
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [sRes, lRes] = await Promise.all([
      fetch('/api/hotel/integration-settings'),
      fetch('/api/integration/outbound-log?limit=50'),
    ]);
    if (sRes.ok) setSettings(await sRes.json());
    if (lRes.ok) setLogs(await lRes.json());
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

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <AppNav />
        <p className="text-slate-400">{tc('noPermission')}</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <AppNav />
        <p className="text-slate-400">{tc('loading')}</p>
      </div>
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

  async function pushMasterData() {
    const res = await fetch('/api/integration/master-data-sync', { method: 'POST' });
    const data = await res.json();
    setMsg(res.ok ? t('e5Sent', { id: data.correlationId }) : data.error);
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AppNav />
      <h1 className="mb-2 text-xl font-semibold">{t('title')}</h1>
      <p className="mb-6 text-sm text-slate-400">{t('subtitle')}</p>

      {msg && <p className="mb-4 text-sm text-slate-300">{msg}</p>}

      <section className="mb-8 space-y-3 rounded-xl border border-slate-700 p-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => toggle('enabled', e.target.checked)}
          />
          {t('globalEnabled')}
        </label>
        <p className="text-xs uppercase text-slate-500">{t('realtimeFolio')}</p>
        {(Object.keys(REALTIME_EVENT_KEYS) as (keyof typeof REALTIME_EVENT_KEYS)[]).map((key) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.realtime[key]}
              onChange={(e) => toggle(key, e.target.checked)}
            />
            {t(REALTIME_EVENT_KEYS[key])}
          </label>
        ))}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.cityLedgerSnapshot}
            onChange={(e) => toggle('cityLedgerSnapshot', e.target.checked)}
          />
          {t('eventCityLedger')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.masterDataSync}
            onChange={(e) => toggle('masterDataSync', e.target.checked)}
          />
          {t('eventMasterData')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.nightAuditClosed}
            onChange={(e) => toggle('nightAuditClosed', e.target.checked)}
          />
          {t('eventNightAudit')}
        </label>
        <label className="block">
          {t('defaultUrl')}
          <input
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs"
            value={settings.urls.default}
            onChange={(e) =>
              setSettings((s) => s && { ...s, urls: { ...s.urls, default: e.target.value } })
            }
          />
        </label>
        <label className="block">
          {t('nightAuditUrl')}
          <input
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs"
            value={settings.urls.nightAudit}
            onChange={(e) =>
              setSettings((s) => s && { ...s, urls: { ...s.urls, nightAudit: e.target.value } })
            }
          />
        </label>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="rounded bg-emerald-700 px-4 py-2 text-sm disabled:opacity-50"
          >
            {tc('save')}
          </button>
          <button
            type="button"
            onClick={retryFailed}
            className="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
          >
            {t('processRetry')}
          </button>
          <button
            type="button"
            onClick={pushMasterData}
            className="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
          >
            {t('pushMasterData')}
          </button>
        </div>
      </section>

      <PosBridgeTest />

      <section className="mb-8 rounded-xl border border-indigo-900/50 p-4">
        <h2 className="mb-2 text-sm font-medium uppercase text-slate-500">{t('e6Title')}</h2>
        <p className="mb-3 text-xs text-slate-400">{t('e6Hint')}</p>
        <E6Simulator onDone={() => load()} />
      </section>

      <section className="rounded-xl border border-slate-700 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('outboundJournal')}</h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="py-1">{tc('time')}</th>
              <th>Event</th>
              <th>{tc('status')}</th>
              <th>{t('attempts')}</th>
              <th>{tc('error')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-800">
                <td className="py-1 pr-2">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="max-w-[10rem] truncate">{l.eventType.replace('SATELLITE_HOTEL_', '')}</td>
                <td>{l.status}</td>
                <td>{l.attempts}</td>
                <td className="max-w-[12rem] truncate text-rose-300">{l.lastError ?? tc('dash')}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-slate-500">
                  {t('noEvents')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
