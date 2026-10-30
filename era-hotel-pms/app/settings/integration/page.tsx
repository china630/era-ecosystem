'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Power, PowerOff, Save } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  GHOST_BUTTON_CLASS,
  useDebouncedValue,
  CatalogField,
  type CatalogOption,
  Field,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  PageHeader,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { REVENUE_CODE_ROLES } from '@/lib/revenue-code-match';
import { revenueLabel } from '@/lib/folio-article-summary';

const ICON_BTN = `${GHOST_BUTTON_CLASS} h-8 w-8 !px-0`;

function glAccountProblem(value: string): 'empty' | 'hyphen' | null {
  const next = value.trim();
  if (!next) return 'empty';
  if (next.includes('-')) return 'hyphen';
  return null;
}

function PosBridgeTestModal({
  open,
  revenueCode,
  onClose,
}: {
  open: boolean;
  /** Code that carries the FOOD role; empty when none is assigned. */
  revenueCode: string;
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
          revenueCode,
          amount: parseFloat(amount),
          description: t('posBridgeDescription'),
          outletCode: 'NAFTANI',
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

interface GlRevenueCode {
  id: string;
  code: string;
  name: string;
  nameAz?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  systemRole: string | null;
  active: boolean;
}

interface GlMapping {
  id: string;
  glAccountCode: string;
  revenueCode: GlRevenueCode;
}

type GlMappingPatch = { glAccountCode?: string; systemRole?: string | null };

function GlMappingRow({
  mapping,
  displayName,
  roleOptions,
  onSave,
  onToggleActive,
}: {
  mapping: GlMapping;
  displayName: string;
  roleOptions: CatalogOption[];
  onSave: (revenueCodeId: string, patch: GlMappingPatch) => Promise<void>;
  onToggleActive: (revenueCodeId: string, active: boolean) => Promise<void>;
}) {
  const t = useTranslations('integration');
  const tc = useTranslations('common');
  const savedRole = mapping.revenueCode.systemRole ?? '';
  const [code, setCode] = useState(mapping.glAccountCode);
  const [role, setRole] = useState(savedRole);
  const [busy, setBusy] = useState(false);
  const active = mapping.revenueCode.active;

  useEffect(() => {
    setCode(mapping.glAccountCode);
  }, [mapping.glAccountCode]);
  useEffect(() => {
    setRole(savedRole);
  }, [savedRole]);

  const glChanged = code.trim() !== mapping.glAccountCode;
  const roleChanged = role !== savedRole;
  const accountProblem = glChanged ? glAccountProblem(code) : null;

  async function saveRow(includeRole: boolean) {
    if (busy) return;
    if (glChanged && accountProblem === 'hyphen') {
      showApiError({ error: t('glAccountDot') });
      return;
    }
    if (glChanged && accountProblem === 'empty') {
      showApiError({ error: t('glAccountRequired') });
      return;
    }
    const patch: GlMappingPatch = {
      ...(glChanged ? { glAccountCode: code.trim() } : {}),
      ...(includeRole && roleChanged ? { systemRole: role || null } : {}),
    };
    if (patch.glAccountCode === undefined && patch.systemRole === undefined) return;
    setBusy(true);
    await onSave(mapping.revenueCode.id, patch);
    setBusy(false);
  }

  return (
    <tr className={`${DATA_TABLE_TR_CLASS} ${active ? '' : 'text-[#95A5A6]'}`}>
      <td className={DATA_TABLE_TD_CLASS}>{mapping.revenueCode.code}</td>
      <td className={DATA_TABLE_TD_CLASS}>{displayName}</td>
      <td className={DATA_TABLE_TD_CLASS}>
        <CatalogField
          kind="CLOSED_MEDIUM"
          widthPreset="select"
          className="[&_label]:!sr-only"
          label={t('systemRole')}
          value={role}
          onChange={(next) => setRole(String(next))}
          options={roleOptions}
        />
      </td>
      <td className={DATA_TABLE_TD_CLASS}>
        <Field
          label={t('glAccount')}
          preset="code"
          className="[&_label]:!sr-only"
          aria-label={t('glAccount')}
          inputClassName={code.trim() ? undefined : 'bg-[#F4F6F7]'}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            void saveRow(false);
          }}
        />
      </td>
      <td className={DATA_TABLE_TD_CLASS}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={ICON_BTN}
            title={tc('save')}
            aria-label={tc('save')}
            disabled={busy || (!glChanged && !roleChanged)}
            onClick={() => void saveRow(true)}
          >
            <Save className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className={ICON_BTN}
            title={active ? t('glDeactivate') : t('glActivate')}
            aria-label={active ? t('glDeactivate') : t('glActivate')}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onToggleActive(mapping.revenueCode.id, !active);
              setBusy(false);
            }}
          >
            {active ? (
              <Power className="h-4 w-4" aria-hidden />
            ) : (
              <PowerOff className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
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
  const locale = useLocale();
  const [glMappings, setGlMappings] = useState<GlMapping[]>([]);
  const [glCodeQ, setGlCodeQ] = useState('');
  const [glNameQ, setGlNameQ] = useState('');
  const [glAccountQ, setGlAccountQ] = useState('');
  const [glActivity, setGlActivity] = useState('active');
  const [glAccountPresence, setGlAccountPresence] = useState('all');
  const debouncedGlCode = useDebouncedValue(glCodeQ, 300);
  const debouncedGlName = useDebouncedValue(glNameQ, 300);
  const debouncedGlAccount = useDebouncedValue(glAccountQ, 300);
  const roleOptions: CatalogOption[] = REVENUE_CODE_ROLES.map((role) => ({
    value: role,
    label: `${role} — ${t(`revenueRole.${role}`)}`,
  }));
  const foodRevenueCode =
    glMappings.find((m) => m.revenueCode.systemRole === 'FOOD')?.revenueCode.code ?? '';
  const [busy, setBusy] = useState(false);
  const [logQ, setLogQ] = useState('');
  const debouncedLogQ = useDebouncedValue(logQ, 300);
  const [posModalOpen, setPosModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');
  const view = viewParam === 'gl' || viewParam === 'journal' ? viewParam : 'events';
  const visibleLogs = useMemo(() => {
    const q = debouncedLogQ.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.eventType.toLowerCase().includes(q) ||
        l.status.toLowerCase().includes(q) ||
        (l.lastError ?? '').toLowerCase().includes(q),
    );
  }, [logs, debouncedLogQ]);

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

  async function saveGlMapping(revenueCodeId: string, patch: GlMappingPatch) {
    const res = await fetch('/api/master/revenue-gl-mappings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revenueCodeId, ...patch }),
    });
    if (!res.ok) {
      const data = await res.json();
      showApiError(data, tc('updateFailed'));
      return;
    }
    showSuccess(t('glMappingSaved'));
    if (patch.systemRole !== undefined) {
      await load();
      return;
    }
    if (patch.glAccountCode !== undefined) {
      const account = patch.glAccountCode;
      setGlMappings((rows) =>
        rows.map((row) =>
          row.revenueCode.id === revenueCodeId ? { ...row, glAccountCode: account } : row,
        ),
      );
    }
  }

  async function setRevenueActive(revenueCodeId: string, active: boolean) {
    const current = glMappings.find((row) => row.revenueCode.id === revenueCodeId);
    if (!active && current?.revenueCode.systemRole) {
      showApiError({ error: t('glDeactivateRole') });
      return;
    }
    const res = await fetch(`/api/master/revenue-codes/${revenueCodeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      const data = await res.json();
      showApiError(data, tc('updateFailed'));
      return;
    }
    showSuccess(tc('success'));
    setGlMappings((rows) =>
      rows.map((row) =>
        row.revenueCode.id === revenueCodeId
          ? { ...row, revenueCode: { ...row.revenueCode, active } }
          : row,
      ),
    );
  }

  const activityOptions: CatalogOption[] = [
    { value: 'active', label: t('glActive') },
    { value: 'inactive', label: t('glInactive') },
    { value: 'all', label: t('glAll') },
  ];
  const accountPresenceOptions: CatalogOption[] = [
    { value: 'all', label: t('glAll') },
    { value: 'mapped', label: t('glMapped') },
    { value: 'unmapped', label: t('glUnmapped') },
  ];
  const visibleGlMappings = useMemo(() => {
    const codeQ = debouncedGlCode.trim().toLowerCase();
    const nameQ = debouncedGlName.trim().toLowerCase();
    const accountQ = debouncedGlAccount.trim().toLowerCase();
    return glMappings.filter((row) => {
      const revenue = row.revenueCode;
      if (glActivity === 'active' && !revenue.active) return false;
      if (glActivity === 'inactive' && revenue.active) return false;
      const hasAccount = row.glAccountCode.trim() !== '';
      if (glAccountPresence === 'mapped' && !hasAccount) return false;
      if (glAccountPresence === 'unmapped' && hasAccount) return false;
      if (codeQ && !revenue.code.toLowerCase().includes(codeQ)) return false;
      if (accountQ && !row.glAccountCode.toLowerCase().includes(accountQ)) return false;
      if (nameQ) {
        const names = [revenue.name, revenue.nameAz, revenue.nameRu, revenue.nameEn]
          .filter((part): part is string => Boolean(part?.trim()))
          .join(' ')
          .toLowerCase();
        if (!names.includes(nameQ)) return false;
      }
      return true;
    });
  }, [
    glMappings,
    debouncedGlCode,
    debouncedGlName,
    debouncedGlAccount,
    glActivity,
    glAccountPresence,
  ]);

  if (!can(PERMISSIONS.MASTER_DATA_MANAGE)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermission')}</p>;
  }

  if (view === 'events' && !settings) {
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
        title={view === 'gl' ? t('glMappingTitle') : view === 'journal' ? t('outboundJournal') : t('title')}
        subtitle={view === 'gl' ? t('glMappingHint') : view === 'journal' ? t('subtitle') : t('subtitle')}
        actions={
          view === 'events' ? (
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setPosModalOpen(true)}>
              {t('posBridgeTest')}
            </button>
          ) : null
        }
      />
      {view === 'events' && settings?.platformSubscription != null && (
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

      {view === 'events' && settings ? (
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
        <p className="m-0 text-[13px] text-[#7F8C8D]">{t('webhookHint')}</p>
        <p className="text-xs font-semibold uppercase text-[#7F8C8D]">{t('realtimeFolio')}</p>
        {(Object.keys(REALTIME_EVENT_KEYS) as (keyof typeof REALTIME_EVENT_KEYS)[]).map((key) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
            className={MODAL_CHECKBOX_CLASS}
            checked={settings.enabled && settings.realtime[key]}
            disabled={!settings.enabled}
            onChange={(e) => toggle(key, e.target.checked)}
            />
            {t(REALTIME_EVENT_KEYS[key])}
          </label>
        ))}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className={MODAL_CHECKBOX_CLASS}
            checked={settings.enabled && settings.cityLedgerSnapshot}
            disabled={!settings.enabled}
            onChange={(e) => toggle('cityLedgerSnapshot', e.target.checked)}
          />
          {t('eventCityLedger')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className={MODAL_CHECKBOX_CLASS}
            checked={settings.enabled && settings.masterDataSync}
            disabled={!settings.enabled}
            onChange={(e) => toggle('masterDataSync', e.target.checked)}
          />
          {t('eventMasterData')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className={MODAL_CHECKBOX_CLASS}
            checked={settings.enabled && settings.nightAuditClosed}
            disabled={!settings.enabled}
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
      ) : null}

      {view === 'gl' ? (
      <section className={`${CARD_CONTAINER_CLASS} mb-6 p-4`}>
        <EraListFilterBar
          resetLabel={tc('filterReset')}
          className="mb-3"
          onReset={() => {
            setGlCodeQ('');
            setGlNameQ('');
            setGlAccountQ('');
            setGlActivity('active');
            setGlAccountPresence('all');
          }}
        >
          <Field
            label={t('glCode')}
            preset="code"
            value={glCodeQ}
            onChange={(e) => setGlCodeQ(e.target.value)}
          />
          <Field
            label={t('glName')}
            preset="shortText"
            value={glNameQ}
            onChange={(e) => setGlNameQ(e.target.value)}
          />
          <Field
            label={t('glAccount')}
            preset="code"
            value={glAccountQ}
            onChange={(e) => setGlAccountQ(e.target.value)}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('glStatus')}
            value={glActivity}
            onChange={(next) => setGlActivity(String(next))}
            options={activityOptions}
            emptyLabel={null}
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('glAccountPresence')}
            value={glAccountPresence}
            onChange={(next) => setGlAccountPresence(String(next))}
            options={accountPresenceOptions}
            emptyLabel={null}
          />
        </EraListFilterBar>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('glCode')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('glName')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('systemRole')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('glAccount')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('glActions')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleGlMappings.map((m) => (
                <GlMappingRow
                  key={m.revenueCode.id}
                  mapping={m}
                  displayName={revenueLabel(m.revenueCode, locale)}
                  roleOptions={roleOptions}
                  onSave={saveGlMapping}
                  onToggleActive={setRevenueActive}
                />
              ))}
              {visibleGlMappings.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {glMappings.length === 0 ? t('noGlMappings') : t('glNoMatch')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {view === 'journal' ? (
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
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('event')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('attempts')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('error')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((l) => (
                <tr key={l.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{bakuDateTimeDisplay(l.createdAt)}</td>
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
              {visibleLogs.length === 0 && (
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
      ) : null}

      <PosBridgeTestModal
        open={posModalOpen}
        revenueCode={foodRevenueCode}
        onClose={() => setPosModalOpen(false)}
      />
    </>
  );
}
