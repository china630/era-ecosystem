'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  PageHeader,
  TAB_ITEM_ACTIVE_CLASS,
  TAB_ITEM_CLASS,
  TAB_STRIP_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

import HotelModuleUpgradeBanner from '@/components/HotelModuleUpgradeBanner';
import { CancelOtaModal } from '@/components/channel/CancelOtaModal';
import { ChannelChannelsTab } from '@/components/channel/ChannelChannelsTab';
import { ChannelDetailModal } from '@/components/channel/ChannelDetailModal';
import { ChannelFormModals } from '@/components/channel/ChannelFormModals';
import { ChannelHealthDetailsModal } from '@/components/channel/ChannelHealthDetailsModal';
import { ChannelInventoryTab } from '@/components/channel/ChannelInventoryTab';
import { ChannelJournalTab } from '@/components/channel/ChannelJournalTab';
import { ChannelOverviewTab } from '@/components/channel/ChannelOverviewTab';
import {
  CHANNEL_PAGE_TABS,
  parseChannelPageTab,
  type AvailabilityRow,
  type ChannelHealth,
  type ChannelMappingRow,
  type ChannelPageTab,
  type RatePlanOption,
  type RoomTypeOption,
  type StopSell,
  type SyncError,
} from '@/components/channel/types';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function ChannelPage() {
  const { can } = useAuth();
  const t = useTranslations('channel');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseChannelPageTab(searchParams.get('tab'));

  const [errors, setErrors] = useState<SyncError[]>([]);
  const [stopSells, setStopSells] = useState<StopSell[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlanOption[]>([]);
  const [channels, setChannels] = useState<ChannelMappingRow[]>([]);
  const [q, setQ] = useState('');
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
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [health, setHealth] = useState<ChannelHealth | null>(null);
  const [cancelRef, setCancelRef] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelOtaModalOpen, setCancelOtaModalOpen] = useState(false);
  const [healthDetailsOpen, setHealthDetailsOpen] = useState(false);
  const [detailChannelId, setDetailChannelId] = useState<string | null>(null);
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

  const setTab = useCallback(
    (next: ChannelPageTab) => {
      setQ('');
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'overview') params.delete('tab');
      else params.set('tab', next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

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
    const aRes = await fetch(`/api/channel/availability?from=${availFrom}&to=${availTo}`);
    if (aRes.ok) setAvailability(await aRes.json());
  }, [availFrom, availTo]);

  useEffect(() => {
    setErrorText(t('defaultSyncError'));
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

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
    setAddChannelModalOpen(false);
    setChannelCode('');
    setChannelName('');
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
    setMapRoomModalOpen(false);
    setMapRoomTypeId('');
    setOtaRoomCode('');
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
    setMapRateModalOpen(false);
    setMapRatePlanId('');
    setOtaRateCode('');
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
    setLogErrorModalOpen(false);
    setOtaRef('');
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
    setStopSellModalOpen(false);
    setStopDate('');
    setStopRoomTypeId('');
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
      showApiError({ error: data.error ?? data.errors?.join('; ') ?? t('pushFailed') });
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
      showApiError({
        error: data.error ?? data.errors?.join('; ') ?? data.message ?? t('pullFailed'),
      });
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
    setCancelOtaModalOpen(false);
    await load();
  }

  const needle = q.trim().toLowerCase();
  const visibleErrors = useMemo(() => {
    if (!needle) return errors;
    return errors.filter((e) =>
      `${e.otaReference ?? ''} ${e.errorMessage}`.toLowerCase().includes(needle),
    );
  }, [errors, needle]);
  const visibleChannels = useMemo(() => {
    if (!needle) return channels;
    return channels.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(needle));
  }, [channels, needle]);
  const visibleStopSells = useMemo(() => {
    if (!needle) return stopSells;
    return stopSells.filter((x) =>
      `${x.date} ${x.note ?? ''} ${x.roomType?.code ?? ''}`.toLowerCase().includes(needle),
    );
  }, [stopSells, needle]);

  const openErrorCount = useMemo(
    () => errors.filter((e) => e.status === 'OPEN').length,
    [errors],
  );
  const detailChannel = useMemo(
    () => channels.find((c) => c.id === detailChannelId) ?? null,
    [channels, detailChannelId],
  );

  const tabLabel = (id: ChannelPageTab) => {
    if (id === 'overview') return t('tabOverview');
    if (id === 'channels') return t('tabChannels');
    if (id === 'inventory') return t('tabInventory');
    return t('tabJournal');
  };

  if (!can(PERMISSIONS.CHANNEL_MANAGE)) {
    return <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionChannel')}</p>;
  }

  return (
    <>
      <PageHeader title={t('title')} />
      <HotelModuleUpgradeBanner moduleKey="hotel_distribution" moduleLabelKey="distributionModule" />

      <div className={TAB_STRIP_CLASS} role="tablist" aria-label={t('tabsAria')}>
        {CHANNEL_PAGE_TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? TAB_ITEM_ACTIVE_CLASS : TAB_ITEM_CLASS}
            onClick={() => setTab(id)}
          >
            {tabLabel(id)}
            {id === 'journal' && openErrorCount > 0 ? ` (${openErrorCount})` : ''}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <ChannelOverviewTab
          health={health}
          channelCount={channels.length}
          openErrorCount={openErrorCount}
          availFrom={availFrom}
          availTo={availTo}
          onAvailFrom={setAvailFrom}
          onAvailTo={setAvailTo}
          syncBusy={syncBusy}
          onPush={() => void pushOta()}
          onPull={() => void pullOta()}
          onOpenCancelOta={() => setCancelOtaModalOpen(true)}
          onOpenHealthDetails={() => setHealthDetailsOpen(true)}
          onGoTab={setTab}
        />
      )}

      {tab === 'channels' && (
        <ChannelChannelsTab
          channels={visibleChannels}
          search={q}
          onSearch={setQ}
          onAddChannel={() => {
            setChannelCode('');
            setChannelName('');
            setAddChannelModalOpen(true);
          }}
          onOpenDetail={setDetailChannelId}
        />
      )}

      {tab === 'inventory' && (
        <ChannelInventoryTab
          availFrom={availFrom}
          availTo={availTo}
          onAvailFrom={setAvailFrom}
          onAvailTo={setAvailTo}
          search={q}
          onSearch={setQ}
          availability={availability}
          stopSells={visibleStopSells}
          onAddStopSell={() => setStopSellModalOpen(true)}
          onRemoveStopSell={(id) => void removeStopSell(id)}
        />
      )}

      {tab === 'journal' && (
        <ChannelJournalTab
          errors={visibleErrors}
          search={q}
          onSearch={setQ}
          onLogError={() => setLogErrorModalOpen(true)}
          onResolve={(id) => void resolve(id)}
        />
      )}

      <CancelOtaModal
        open={cancelOtaModalOpen}
        busy={cancelBusy}
        cancelRef={cancelRef}
        onCancelRef={setCancelRef}
        onClose={() => setCancelOtaModalOpen(false)}
        onSubmit={(e) => void cancelOtaReservation(e)}
      />

      <ChannelHealthDetailsModal
        open={healthDetailsOpen}
        health={health}
        onClose={() => setHealthDetailsOpen(false)}
      />

      <ChannelDetailModal
        open={Boolean(detailChannelId)}
        channel={detailChannel}
        onClose={() => setDetailChannelId(null)}
        onMapRoom={() => {
          if (detailChannelId) openMapRoom(detailChannelId);
        }}
        onMapRate={() => {
          if (detailChannelId) openMapRate(detailChannelId);
        }}
      />

      <ChannelFormModals
        stopSellModalOpen={stopSellModalOpen}
        logErrorModalOpen={logErrorModalOpen}
        addChannelModalOpen={addChannelModalOpen}
        mapRoomModalOpen={mapRoomModalOpen}
        mapRateModalOpen={mapRateModalOpen}
        busy={busy}
        stopDate={stopDate}
        stopRoomTypeId={stopRoomTypeId}
        otaRef={otaRef}
        errorText={errorText}
        channelCode={channelCode}
        channelName={channelName}
        mapRoomTypeId={mapRoomTypeId}
        otaRoomCode={otaRoomCode}
        mapRatePlanId={mapRatePlanId}
        otaRateCode={otaRateCode}
        roomTypes={roomTypes}
        ratePlans={ratePlans}
        onStopDate={setStopDate}
        onStopRoomTypeId={setStopRoomTypeId}
        onOtaRef={setOtaRef}
        onErrorText={setErrorText}
        onChannelCode={setChannelCode}
        onChannelName={setChannelName}
        onMapRoomTypeId={setMapRoomTypeId}
        onOtaRoomCode={setOtaRoomCode}
        onMapRatePlanId={setMapRatePlanId}
        onOtaRateCode={setOtaRateCode}
        onCloseStopSell={() => setStopSellModalOpen(false)}
        onCloseLogError={() => setLogErrorModalOpen(false)}
        onCloseAddChannel={() => setAddChannelModalOpen(false)}
        onCloseMapRoom={() => setMapRoomModalOpen(false)}
        onCloseMapRate={() => setMapRateModalOpen(false)}
        onAddStopSell={(e) => void addStopSell(e)}
        onLogError={(e) => void logError(e)}
        onAddChannel={(e) => void addChannel(e)}
        onMapRoomType={(e) => void mapRoomType(e)}
        onMapRatePlan={(e) => void mapRatePlan(e)}
      />
    </>
  );
}
