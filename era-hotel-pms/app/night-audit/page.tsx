'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { bakuDateTimeDisplay } from '@era/satellite-kit/time';
import { PageHeader } from '@era/satellite-kit/ui';
import ReservationCardModal from '@/components/ReservationCardModal';

interface Reservation {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guest: { fullName: string };
  room: { roomNumber: string } | null;
}

interface CashShift {
  id: string;
  cashier: string;
  registerId: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
}

interface NightAuditStatus {
  openShift: CashShift | null;
  inHouseCount?: number;
  businessDay: { date: string; status: string } | null;
  businessDate?: {
    currentBusinessDate: string;
    wallClockDate: string;
    lagDays: number;
    businessDayStatus: string | null;
    locked: boolean;
    strictGate: boolean;
  };
  pendingSettlement?: {
    count: number;
    policy: 'BLOCK' | 'WARN';
  };
  lastRun: {
    status: string;
    stepsJson: string;
    errorsJson: string | null;
    completedAt: string | null;
  } | null;
  polishPreview?: {
    unassignedArrivals: number;
    noShowCandidates: number;
  };
  deskHold?: {
    missedArrivals: Reservation[];
    dueOuts: Reservation[];
    missedCount: number;
    dueCount: number;
  };
  unclosedCashRows?: number;
  posShiftStatus?: {
    hasOpenShift: boolean;
    confirmed?: boolean;
    outlets: Array<{ outletCode: string }>;
  };
}

interface NightAuditRunRow {
  id: string;
  status: string;
  stepsJson: string;
  errorsJson: string | null;
  createdAt: string;
  businessDay: { date: string };
}

export default function OperationsPage() {
  const t = useTranslations('operations');
  const tc = useTranslations('common');
  const [status, setStatus] = useState<NightAuditStatus | null>(null);
  const [runs, setRuns] = useState<NightAuditRunRow[]>([]);
  const [openReservationId, setOpenReservationId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tourismFailed, setTourismFailed] = useState<
    { id: string; eventKind: string; errorMessage: string | null; reservation: { guest: { fullName: string } } }[]
  >([]);

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/night-audit/status');
    if (res.ok) setStatus(await res.json());
  }, []);

  const loadRuns = useCallback(async () => {
    const res = await fetch('/api/night-audit/runs?limit=5');
    if (res.ok) setRuns(await res.json());
  }, []);

  const loadTourism = useCallback(async () => {
    const res = await fetch('/api/tourism/failed');
    if (res.ok) setTourismFailed(await res.json());
  }, []);

  useEffect(() => {
    loadStatus();
    loadRuns();
    loadTourism();
  }, [loadStatus, loadRuns, loadTourism]);

  async function retryTourism(id: string) {
    const res = await fetch(`/api/tourism/${id}/retry`, { method: 'POST' });
    setMsg(res.ok ? t('tourismRetrySent') : t('retryFailed'));
    await loadTourism();
  }

  const unclosedCashRows = status?.unclosedCashRows ?? 0;
  const cashBlocked = unclosedCashRows > 0;
  const pendingCount = status?.pendingSettlement?.count ?? 0;
  const pendingBlocksNa =
    pendingCount > 0 && status?.pendingSettlement?.policy === 'BLOCK';
  const missedCount = status?.deskHold?.missedCount ?? 0;
  const dueOutCount = status?.deskHold?.dueCount ?? 0;
  const deskBlocked = missedCount > 0 || dueOutCount > 0;
  const naBlocked = cashBlocked || pendingBlocksNa || deskBlocked;

  async function runNightAudit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/night-audit/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('failed'));
      const warning = typeof data.dispatch?.warning === 'string' ? data.dispatch.warning : '';
      setMsg(
        warning
          ? t('financeWarning', { message: warning })
          : t('nightAuditResult', { status: data.run?.status ?? 'done' }),
      );
      await loadStatus();
      await loadRuns();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tc('error'));
    } finally {
      setBusy(false);
    }
  }

  async function retryEvents() {
    const res = await fetch('/api/integration/retry', { method: 'POST' });
    const data = await res.json();
    setMsg(t('retryQueue', { count: data.sent }));
  }

  function parseSteps(json: string): string[] {
    try {
      const arr = JSON.parse(json);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  const lastSteps = status?.lastRun ? parseSteps(status.lastRun.stepsJson) : [];

  return (
    <>
      <PageHeader title={t('title')} />
      {msg ? (
        <p className="mb-4 rounded-lg border border-[#D5DADF] bg-white px-4 py-2 text-[13px] text-[#34495E]">
          {msg}
        </p>
      ) : null}

      {status?.businessDate && (
        <section
          className={`${CARD_CONTAINER_CLASS} p-4 mb-6 text-[13px] ${
            status.businessDate.lagDays > 0
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-[#2980B9]/30 bg-[#F8FAFC] text-[#34495E]'
          }`}>

          {t('bannerBusinessDate')}: <strong>{status.businessDate.currentBusinessDate}</strong>
          {' · '}
          {t('bannerWallClock')}: {status.businessDate.wallClockDate}
          {status.businessDate.lagDays > 0 && (
            <> · {t('bannerLag', { count: status.businessDate.lagDays })}</>
          )}
          {status.businessDate.locked && <> · {t('bannerLocked')}</>}
        </section>
      )}

      <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('nightAudit')}</h2>
          <Link href="/night-audit/logs" className="text-[13px] text-[#2980B9] hover:underline">
            {t('viewEodLogs')}
          </Link>
        </div>
        <ul className="mb-4 space-y-1 text-[13px] text-[#7F8C8D]">
          <li>
            {t('inHouse')} {status?.inHouseCount ?? tc('dash')}
          </li>
          <li>
            {t('businessDay')}{' '}
            {status?.businessDay?.date?.slice(0, 10) ??
              status?.businessDate?.currentBusinessDate ??
              tc('dash')}{' '}
            ({status?.businessDay?.status ?? status?.businessDate?.businessDayStatus ?? tc('dash')})
          </li>
          <li>
            {t('posShiftStatus')}{' '}
            {status?.posShiftStatus?.hasOpenShift ? (
              <span className="text-rose-600">
                {status.posShiftStatus.confirmed === false
                  ? t('posShiftUnreachable', {
                      outlet: status.posShiftStatus.outlets.map((row) => row.outletCode).join(', '),
                    })
                  : t('posShiftOpen', {
                      outlet: status.posShiftStatus.outlets.map((row) => row.outletCode).join(', '),
                    })}
              </span>
            ) : (
              t('posShiftOk')
            )}
          </li>
          <li>
            {t('cashDeskStatus')}{' '}
            {cashBlocked ? (
              <>
                {t('cashDeskOpenBlock', { count: unclosedCashRows })}{' '}
                <Link href="/front-cash/desk" className="text-[#2980B9] hover:underline">
                  {t('openCashDesk')}
                </Link>
              </>
            ) : (
              t('cashDeskOk')
            )}
          </li>
          {status?.polishPreview ? (
            <li className="mt-2 rounded-lg border border-[#D5DADF] bg-[#F8FAFC] px-3 py-2">
              <p className="m-0 mb-1 text-[12px] font-semibold text-[#34495E]">
                {t('polishPreviewTitle')}
              </p>
              <p className="m-0 mb-2 text-[11px] text-[#7F8C8D]">{t('polishPreviewHint')}</p>
              <ul className="m-0 list-disc space-y-0.5 pl-4">
                <li>
                  {t('unassignedArrivals', {
                    count: status.polishPreview.unassignedArrivals,
                  })}
                </li>
                <li>
                  {t('deskHoldMissed', { count: missedCount })}{' '}
                  {missedCount > 0 ? (
                    <Link
                      href="/fo/reservations?queue=bookings&overdue=1"
                      className="text-[#2980B9] hover:underline"
                    >
                      {t('openMissedList')}
                    </Link>
                  ) : null}
                </li>
                <li>
                  {t('deskHoldDue', { count: dueOutCount })}{' '}
                  {dueOutCount > 0 ? (
                    <Link href="/fo/reservations?queue=inHouse" className="text-[#2980B9] hover:underline">
                      {t('openInHouseList')}
                    </Link>
                  ) : null}
                </li>
              </ul>
            </li>
          ) : null}
          {pendingCount > 0 && (
            <li className={pendingBlocksNa ? 'text-rose-600 font-medium' : 'text-amber-700'}>
              {t('pendingSettlementCount', { count: pendingCount })}
              {' — '}
              <Link href="/front-cash/pending" className="text-[#2980B9] hover:underline">
                {t('viewPendingQueue')}
              </Link>
            </li>
          )}
        </ul>
        {cashBlocked && <p className="mb-3 text-[13px] text-rose-600">{t('closeCashDeskBeforeNa')}</p>}
        {pendingBlocksNa && (
          <p className="mb-3 text-[13px] text-rose-600">{t('pendingSettlementBlock')}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || naBlocked}
            onClick={runNightAudit}
            className={PRIMARY_BUTTON_CLASS}
          >
            {t('runNightAudit')}
          </button>
          <button type="button" onClick={retryEvents} className={SECONDARY_BUTTON_CLASS}>
            {t('processRetry')}
          </button>
        </div>
        {lastSteps.length > 0 && (
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-[13px] text-[#34495E]">
            {lastSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </section>

      {runs.length > 0 && (
        <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6`}>
          <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t('recentRuns')}</h2>
          <ul className="space-y-2 text-[13px] text-[#7F8C8D]">
            {runs.map((r) => (
              <li key={r.id}>
                {r.businessDay.date.slice(0, 10)} — {r.status} ({bakuDateTimeDisplay(r.createdAt)})
              </li>
            ))}
          </ul>
        </section>
      )}

      {tourismFailed.length > 0 && (
        <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6 border-amber-200 bg-amber-50`}>
          <h2 className="mb-3 text-sm font-semibold text-amber-900">{t('tourismRegistry')}</h2>
          <ul className="space-y-2 text-[13px] text-[#34495E]">
            {tourismFailed.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {row.reservation.guest.fullName} — {row.eventKind}:{' '}
                  {row.errorMessage ?? tc('failedStatus')}
                </span>
                <button type="button" onClick={() => retryTourism(row.id)} className={SECONDARY_BUTTON_CLASS}>
                  {tc('retry')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReservationCardModal
        open={Boolean(openReservationId)}
        reservationId={openReservationId}
        onClose={() => {
          setOpenReservationId(null);
          void loadStatus();
        }}
      />

      {deskBlocked ? (
        <section className={`${CARD_CONTAINER_CLASS} p-4`}>
          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('noShowCandidates')}</h2>
          <ul className="space-y-2 text-[13px] text-[#34495E]">
            {(status?.deskHold?.missedArrivals ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {r.guest.fullName}
                  {r.room?.roomNumber ? ` · ${r.room.roomNumber}` : ''} — {t('due')}{' '}
                  {String(r.checkInDate).slice(0, 10)}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenReservationId(r.id)}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {t('openReservation')}
                </button>
              </li>
            ))}
            {(status?.deskHold?.dueOuts ?? []).map((r) => (
              <li key={`out-${r.id}`} className="flex flex-wrap items-center gap-2">
                <span>
                  {r.guest.fullName}
                  {r.room?.roomNumber ? ` · ${r.room.roomNumber}` : ''} — {String(r.checkOutDate).slice(0, 10)}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenReservationId(r.id)}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {t('openReservation')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

    </>
  );
}
