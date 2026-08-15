'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  DatePicker,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

import { EraModal, EraModalFooter } from '@/components/EraModal';

import HotelModuleUpgradeBanner from '@/components/HotelModuleUpgradeBanner';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface SyncError {
  id: string;
  otaReference: string | null;
  errorMessage: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
}

interface ChannelHealth {
  adapter: string;
  mode: 'dryRun' | 'live';
  envReady: boolean;
  envFlags: Record<string, boolean>;
  channelAutoPushEnabled: boolean;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: {
    errorMessage: string;
    status: string;
    otaReference: string | null;
    createdAt: string;
  } | null;
}

interface StopSell {
  id: string;
  date: string;
  note: string | null;
  roomType: { code: string } | null;
}

interface RoomType {
  id: string;
  code: string;
}

interface RatePlan {
  id: string;
  code: string;
}

interface ChannelMappingRow {
  id: string;
  code: string;
  name: string;
  active: boolean;
  roomMappings: Array<{
    id: string;
    otaRoomCode: string;
    roomType: { id: string; code: string };
  }>;
  rateMappings: Array<{
    id: string;
    otaRateCode: string;
    ratePlan: { id: string; code: string };
  }>;
}

export default function ChannelPage() {
  const { can } = useAuth();
  const t = useTranslations('channel');
  const tc = useTranslations('common');
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [stopSells, setStopSells] = useState<StopSell[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [channels, setChannels] = useState<ChannelMappingRow[]>([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [availFrom, setAvailFrom] = useState(new Date().toISOString().slice(0, 10));
  const [availTo, setAvailTo] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const [otaRef, setOtaRef] = useState('');
  const [errorText, setErrorText] = useState('');
  const [stopDate, setStopDate] = useState('');
  const [stopRoomTypeId, setStopRoomTypeId] = useState('');
  const [stopSellModalOpen, setStopSellModalOpen] = useState(false);
  const [logErrorModalOpen, setLogErrorModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [availability, setAvailability] = useState<
    Array<{ roomTypeCode: string; days: Array<{ date: string; available: number; stopSell: boolean }> }>
  >([]);
  const [health, setHealth] = useState<ChannelHealth | null>(null);
  const [cancelRef, setCancelRef] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState<'push' | 'pull' | null>(null);
  const [addChannelModalOpen, setAddChannelModalOpen] = useState(false);
  const [mapRoomModalOpen, setMapRoomModalOpen] = useState(false);
  const [mapRateModalOpen, setMapRateModalOpen] = useState(false);
  const [channelCode, setChannelCode] = useState('');
  const [channelName, setChannelName] = useState('');
  const [mapChannelId, setMapChannelId] = useState('');
  const [mapRoomTypeId, setMapRoomTypeId] = useState('');
  const [otaRoomCode, setOtaRoomCode] = useState('');
  const [mapRatePlanId, setMapRatePlanId] = useState('');
  const [otaRateCode, setOtaRateCode] = useState('');

  const load = useCallback(async () => {
    const [eRes, sRes, rtRes, rpRes, chRes, hRes] = await Promise.all([
      fetch('/api/channel/errors'),
      fetch('/api/channel/stop-sell'),
      fetch('/api/master/room-types'),
      fetch('/api/master/rate-plans'),
      fetch('/api/channel/mappings'),
      fetch('/api/channel/health'),
    ]);
    if (eRes.ok) setErrors(await eRes.json());
    if (sRes.ok) setStopSells(await sRes.json());
    if (rtRes.ok) setRoomTypes(await rtRes.json());
    if (rpRes.ok) setRatePlans(await rpRes.json());
    if (chRes.ok) setChannels(await chRes.json());
    if (hRes.ok) setHealth(await hRes.json());
    const aRes = await fetch(
      `/api/channel/availability?from=${availFrom}&to=${availTo}`,
    );
    if (aRes.ok) setAvailability(await aRes.json());
  }, [availFrom, availTo]);

  useEffect(() => {
    setErrorText(t('defaultSyncError'));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const stopSellFormId = 'stop-sell-form';
  const logErrorFormId = 'log-error-form';
  const addChannelFormId = 'add-channel-form';
  const mapRoomFormId = 'map-room-form';
  const mapRateFormId = 'map-rate-form';

  async function addChannel(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/channel/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: channelCode, name: channelName }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError({ error: data.error ?? tc('failed') });
      return;
    }
    showSuccess(t('channelCreated'));
    if (res.ok) {
      setAddChannelModalOpen(false);
      setChannelCode('');
      setChannelName('');
    }
    await load();
  }

  async function mapRoomType(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/channel/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: mapChannelId,
        roomTypeId: mapRoomTypeId,
        otaRoomCode: otaRoomCode || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError({ error: data.error ?? tc('failed') });
      return;
    }
    showSuccess(t('roomMappingSaved'));
    if (res.ok) {
      setMapRoomModalOpen(false);
      setMapRoomTypeId('');
      setOtaRoomCode('');
    }
    await load();
  }

  async function mapRatePlan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/channel/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: mapChannelId,
        ratePlanId: mapRatePlanId,
        otaRateCode: otaRateCode || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError({ error: data.error ?? tc('failed') });
      return;
    }
    showSuccess(t('rateMappingSaved'));
    if (res.ok) {
      setMapRateModalOpen(false);
      setMapRatePlanId('');
      setOtaRateCode('');
    }
    await load();
  }

  function openMapRoom(channelId: string) {
    setMapChannelId(channelId);
    setMapRoomTypeId('');
    setOtaRoomCode('');
    setMapRoomModalOpen(true);
  }

  function openMapRate(channelId: string) {
    setMapChannelId(channelId);
    setMapRatePlanId('');
    setOtaRateCode('');
    setMapRateModalOpen(true);
  }

  async function logError(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/channel/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otaReference: otaRef || undefined, errorMessage: errorText }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError({ error: data.error ?? tc('failed') });
      return;
    }
    showSuccess(t('errorLogged'));
    if (res.ok) {
      setLogErrorModalOpen(false);
      setOtaRef('');
    }
    await load();
  }

  async function resolve(id: string) {
    const res = await fetch(`/api/channel/errors?id=${id}`, { method: 'PATCH' });
    const data = await res.json();
    if (!res.ok) {
      showApiError({ error: data.error ?? tc('failed') });
      return;
    }
    showSuccess(t('resolved'));
    await load();
  }

  async function addStopSell(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/channel/stop-sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: stopDate,
        roomTypeId: stopRoomTypeId || undefined,
        note: 'CH-01 stop sell',
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showApiError({ error: data.error ?? tc('failed') });
      return;
    }
    showSuccess(t('salesClosed'));
    if (res.ok) {
      setStopSellModalOpen(false);
      setStopDate('');
      setStopRoomTypeId('');
    }
    await load();
  }

  async function removeStopSell(id: string) {
    const res = await fetch(`/api/channel/stop-sell?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showApiError({ error: data.error ?? tc('failed') });
      return;
    }
    showSuccess(t('stopSellRemoved'));
    await load();
  }

  async function pushOta() {
    setSyncBusy('push');
    const res = await fetch('/api/channel/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: availFrom, to: availTo }),
    });
    const data = await res.json();
    setSyncBusy(null);
    if (res.ok && data.ok !== false) {
      showSuccess(t('pushSuccess', { adapter: data.adapter ?? '—', rows: data.rowCount ?? 0 }));
    } else {
      const err = data.error ?? data.errors?.join('; ') ?? t('pushFailed');
      showApiError({ error: err });
    }
    await load();
  }

  async function pullOta() {
    setSyncBusy('pull');
    const res = await fetch('/api/channel/sync/pull', { method: 'POST' });
    const data = await res.json();
    setSyncBusy(null);
    if (res.ok && data.ok !== false) {
      showSuccess(
        t('pullSuccess', {
          pulled: data.pulled ?? 0,
          created: data.created ?? 0,
          updated: data.updated ?? 0,
          cancelled: data.cancelled ?? 0,
        }),
      );
    } else {
      const err = data.error ?? data.errors?.join('; ') ?? data.message ?? t('pullFailed');
      showApiError({ error: err });
    }
    await load();
  }

  async function cancelOtaReservation(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelRef.trim()) {
      showApiError({ error: t('cancelRefRequired') });
      return;
    }
    setCancelBusy(true);
    const res = await fetch('/api/channel/ota-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalRef: cancelRef.trim() }),
    });
    const data = await res.json();
    setCancelBusy(false);
    if (!res.ok) {
      showApiError({ error: data.error ?? t('cancelFailed') });
      return;
    }
    showSuccess(t('cancelSuccess'));
    setCancelRef('');
    await load();
  }

  const needle = debouncedQ.trim().toLowerCase();
  const visibleErrors = useMemo(() => {
    if (!needle) return errors;
    return errors.filter((e) =>
      `${e.otaReference ?? ''} ${e.errorMessage}`.toLowerCase().includes(needle),
    );
  }, [errors, needle]);
  const visibleChannels = useMemo(() => {
    if (!needle) return channels;
    return channels.filter((c) =>
      `${c.code} ${c.name}`.toLowerCase().includes(needle),
    );
  }, [channels, needle]);
  const visibleStopSells = useMemo(() => {
    if (!needle) return stopSells;
    return stopSells.filter((x) =>
      `${x.date} ${x.note ?? ''} ${x.roomType?.code ?? ''}`.toLowerCase().includes(needle),
    );
  }, [stopSells, needle]);

  function formatSyncTime(iso: string | null) {
    if (!iso) return t('neverSynced');
    return new Date(iso).toLocaleString();
  }

  if (!can(PERMISSIONS.CHANNEL_MANAGE)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionChannel')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} />
      <HotelModuleUpgradeBanner moduleKey="hotel_distribution" moduleLabelKey="distributionModule" />
      
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          const from = new Date().toISOString().slice(0, 10);
          const to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
          setAvailFrom(from);
          setAvailTo(to);
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <DatePicker
          label={tc('from')}
          value={availFrom}
          onChange={setAvailFrom}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
        <DatePicker
          label={tc('to')}
          value={availTo}
          onChange={setAvailTo}
          placeholder={tc('datePlaceholder')}
          openCalendarLabel={tc('openCalendar')}
        />
      </EraListFilterBar>

      <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('mappingsTitle')}</h2>
            <p className="mt-1 text-[13px] text-[#7F8C8D]">{t('mappingsHint')}</p>
          </div>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setChannelCode('');
              setChannelName('');
              setAddChannelModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t('addChannel')}
          </button>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('code')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('roomMappings')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('rateMappings')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {visibleChannels.map((ch) => (
                <tr key={ch.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{ch.code}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{ch.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {ch.roomMappings.length === 0 ? (
                      <span className="text-[#7F8C8D]">{t('noRoomMappings')}</span>
                    ) : (
                      <ul className="m-0 list-none space-y-1 p-0">
                        {ch.roomMappings.map((m) => (
                          <li key={m.id} className="text-[12px]">
                            {m.roomType.code} → {m.otaRoomCode}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {ch.rateMappings.length === 0 ? (
                      <span className="text-[#7F8C8D]">{t('noRateMappings')}</span>
                    ) : (
                      <ul className="m-0 list-none space-y-1 p-0">
                        {ch.rateMappings.map((m) => (
                          <li key={m.id} className="text-[12px]">
                            {m.ratePlan.code} → {m.otaRateCode}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={GHOST_BUTTON_CLASS}
                        onClick={() => openMapRoom(ch.id)}
                      >
                        {t('mapRoomType')}
                      </button>
                      <button
                        type="button"
                        className={GHOST_BUTTON_CLASS}
                        onClick={() => openMapRate(ch.id)}
                      >
                        {t('mapRatePlan')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {channels.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('noChannels')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6`}>
        <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t('healthTitle')}</h2>
        <p className="mb-3 text-[13px] text-[#7F8C8D]">{t('healthHint')}</p>
        <div className="mb-4 grid gap-2 text-[13px] text-[#34495E] sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="text-[#7F8C8D]">{t('healthAdapter')}: </span>
            {health?.adapter ?? tc('dash')}
          </div>
          <div>
            <span className="text-[#7F8C8D]">{t('healthMode')}: </span>
            {health
              ? health.mode === 'live'
                ? t('healthModeLive')
                : t('healthModeDryRun')
              : tc('dash')}
          </div>
          <div>
            <span className="text-[#7F8C8D]">{t('healthEnvReady')}: </span>
            {health ? (health.envReady ? t('healthEnvYes') : t('healthEnvNo')) : tc('dash')}
          </div>
          <div>
            <span className="text-[#7F8C8D]">{t('healthAutoPush')}: </span>
            {health
              ? health.channelAutoPushEnabled
                ? t('healthAutoPushOn')
                : t('healthAutoPushOff')
              : tc('dash')}
          </div>
          <div>
            <span className="text-[#7F8C8D]">{t('lastPush')}: </span>
            {formatSyncTime(health?.lastPushAt ?? null)}
          </div>
          <div>
            <span className="text-[#7F8C8D]">{t('lastPull')}: </span>
            {formatSyncTime(health?.lastPullAt ?? null)}
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="text-[#7F8C8D]">{t('lastError')}: </span>
            <span className={health?.lastError ? 'text-rose-600' : ''}>
              {health?.lastError
                ? `${health.lastError.errorMessage} (${health.lastError.status})`
                : tc('dash')}
            </span>
          </div>
        </div>

        <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t('otaSync')}</h2>
        <p className="mb-3 text-[13px] text-[#7F8C8D]">{t('otaSyncHint')}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={syncBusy !== null}
            onClick={() => void pushOta()}
          >
            {syncBusy === 'push' ? t('pushing') : t('pushAvailability')}
          </button>
          <button
            type="button"
            className={GHOST_BUTTON_CLASS}
            disabled={syncBusy !== null}
            onClick={() => void pullOta()}
          >
            {syncBusy === 'pull' ? t('pulling') : t('pullReservations')}
          </button>
        </div>

        <form
          onSubmit={(e) => void cancelOtaReservation(e)}
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-[#ECF0F1] pt-4"
        >
          <div className="min-w-[220px] flex-1">
            <Field
              label={t('cancelOtaRef')}
              preset="longText"
              value={cancelRef}
              onChange={(e) => setCancelRef(e.target.value)}
              placeholder={t('cancelOtaPlaceholder')}
            />
          </div>
          <button type="submit" className={GHOST_BUTTON_CLASS} disabled={cancelBusy}>
            {cancelBusy ? t('cancelling') : t('cancelOta')}
          </button>
        </form>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6`}>
        <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t('availabilityMatrix')}</h2>
        <div className="overflow-x-auto text-[12px]">
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('roomType')}</th>
                {availability[0]?.days.map((d) => (
                  <th key={d.date} className={DATA_TABLE_TH_LEFT_CLASS}>
                    {d.date.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {availability.map((row) => (
                <tr key={row.roomTypeCode} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{row.roomTypeCode}</td>
                  {row.days.map((d) => (
                    <td
                      key={d.date}
                      className={`${DATA_TABLE_TD_CLASS} ${d.stopSell ? 'bg-rose-100' : ''}`}
                    >
                      {d.available}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('stopSell')}</h2>
            <p className="mt-1 text-[13px] text-[#7F8C8D]">{t('stopSellHint')}</p>
          </div>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setStopSellModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('closeSales')}
          </button>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('date')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('roomType')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {visibleStopSells.map((s) => (
                <tr key={s.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{s.date.slice(0, 10)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{s.roomType?.code ?? tc('all')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button type="button" onClick={() => removeStopSell(s.id)} className={GHOST_BUTTON_CLASS}>
                      {tc('remove')}
                    </button>
                  </td>
                </tr>
              ))}
              {stopSells.length === 0 && (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={3} className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`}>
                    {t('noStopSell')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('syncJournal')}</h2>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setLogErrorModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('logSyncError')}
          </button>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('otaRef')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('message')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {visibleErrors.map((e) => (
                <tr key={e.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{e.otaReference ?? tc('dash')}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{e.errorMessage}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {e.status === 'RESOLVED' ? t('resolved') : t('open')}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {e.status === 'OPEN' && (
                      <button type="button" onClick={() => resolve(e.id)} className={GHOST_BUTTON_CLASS}>
                        {tc('resolve')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <EraModal
        open={stopSellModalOpen}
        title={t('stopSell')}
        subtitle={t('stopSellHint')}
        onClose={() => setStopSellModalOpen(false)}
        footer={
          <EraModalFooter
            formId={stopSellFormId}
            onCancel={() => setStopSellModalOpen(false)}
            busy={busy}
            submitLabel={t('closeSales')}
          />
        }
      >
        <form id={stopSellFormId} onSubmit={addStopSell} className={FORM_STACK_CLASS}>
          <DatePicker
            label={tc('date')}
            value={stopDate}
            onChange={setStopDate}
            placeholder={tc('datePlaceholder')}
            openCalendarLabel={tc('openCalendar')}
            required
          />
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="stop-roomType">
              {t('roomType')}
            </label>
            <select
              id="stop-roomType"
              className={MODAL_INPUT_CLASS}
              value={stopRoomTypeId}
              onChange={(e) => setStopRoomTypeId(e.target.value)}
            >
              <option value="">{t('allRoomTypes')}</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.code}
                </option>
              ))}
            </select>
          </div>
        </form>
      </EraModal>

      <EraModal
        open={logErrorModalOpen}
        title={t('logSyncError')}
        onClose={() => setLogErrorModalOpen(false)}
        footer={
          <EraModalFooter
            formId={logErrorFormId}
            onCancel={() => setLogErrorModalOpen(false)}
            busy={busy}
            submitLabel={t('logSyncError')}
          />
        }
      >
        <form id={logErrorFormId} onSubmit={logError} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ota-ref">
              {t('otaReference')}
            </label>
            <input
              id="ota-ref"
              className={MODAL_INPUT_CLASS}
              value={otaRef}
              onChange={(e) => setOtaRef(e.target.value)}
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="error-text">
              {t('errorMessage')}
            </label>
            <input
              id="error-text"
              className={MODAL_INPUT_CLASS}
              value={errorText}
              onChange={(e) => setErrorText(e.target.value)}
              required
            />
          </div>
        </form>
      </EraModal>

      <EraModal
        open={addChannelModalOpen}
        title={t('addChannel')}
        onClose={() => setAddChannelModalOpen(false)}
        footer={
          <EraModalFooter
            formId={addChannelFormId}
            onCancel={() => setAddChannelModalOpen(false)}
            busy={busy}
            submitLabel={t('addChannel')}
          />
        }
      >
        <form id={addChannelFormId} onSubmit={addChannel} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="channel-code">
              {t('channelCode')}
            </label>
            <input
              id="channel-code"
              className={MODAL_INPUT_CLASS}
              value={channelCode}
              onChange={(e) => setChannelCode(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="channel-name">
              {t('channelName')}
            </label>
            <input
              id="channel-name"
              className={MODAL_INPUT_CLASS}
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              required
            />
          </div>
        </form>
      </EraModal>

      <EraModal
        open={mapRoomModalOpen}
        title={t('mapRoomType')}
        onClose={() => setMapRoomModalOpen(false)}
        footer={
          <EraModalFooter
            formId={mapRoomFormId}
            onCancel={() => setMapRoomModalOpen(false)}
            busy={busy}
            submitLabel={t('mapRoomType')}
          />
        }
      >
        <form id={mapRoomFormId} onSubmit={mapRoomType} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="map-room-type">
              {t('roomType')}
            </label>
            <select
              id="map-room-type"
              className={MODAL_INPUT_CLASS}
              value={mapRoomTypeId}
              onChange={(e) => setMapRoomTypeId(e.target.value)}
              required
            >
              <option value="">{tc('select')}</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.code}
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ota-room-code">
              {t('otaRoomCode')}
            </label>
            <input
              id="ota-room-code"
              className={MODAL_INPUT_CLASS}
              value={otaRoomCode}
              onChange={(e) => setOtaRoomCode(e.target.value)}
              placeholder="ROOM"
            />
          </div>
        </form>
      </EraModal>

      <EraModal
        open={mapRateModalOpen}
        title={t('mapRatePlan')}
        onClose={() => setMapRateModalOpen(false)}
        footer={
          <EraModalFooter
            formId={mapRateFormId}
            onCancel={() => setMapRateModalOpen(false)}
            busy={busy}
            submitLabel={t('mapRatePlan')}
          />
        }
      >
        <form id={mapRateFormId} onSubmit={mapRatePlan} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="map-rate-plan">
              {t('ratePlan')}
            </label>
            <select
              id="map-rate-plan"
              className={MODAL_INPUT_CLASS}
              value={mapRatePlanId}
              onChange={(e) => setMapRatePlanId(e.target.value)}
              required
            >
              <option value="">{tc('select')}</option>
              {ratePlans.map((rp) => (
                <option key={rp.id} value={rp.id}>
                  {rp.code}
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ota-rate-code">
              {t('otaRateCode')}
            </label>
            <input
              id="ota-rate-code"
              className={MODAL_INPUT_CLASS}
              value={otaRateCode}
              onChange={(e) => setOtaRateCode(e.target.value)}
              placeholder="RATE"
            />
          </div>
        </form>
      </EraModal>
    </>
  );
}
