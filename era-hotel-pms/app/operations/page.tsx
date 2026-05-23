'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface Reservation {
  id: string;
  status: string;
  checkInDate: string;
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
  lastRun: {
    status: string;
    stepsJson: string;
    errorsJson: string | null;
    completedAt: string | null;
  } | null;
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
  const { can } = useAuth();
  const t = useTranslations('operations');
  const tc = useTranslations('common');
  const [status, setStatus] = useState<NightAuditStatus | null>(null);
  const [runs, setRuns] = useState<NightAuditRunRow[]>([]);
  const [noShows, setNoShows] = useState<Reservation[]>([]);
  const [cashier, setCashier] = useState('');
  const [registerId, setRegisterId] = useState('REG-01');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tourismFailed, setTourismFailed] = useState<
    { id: string; eventKind: string; errorMessage: string | null; reservation: { guest: { fullName: string } } }[]
  >([]);

  const loadNoShows = useCallback(async () => {
    const res = await fetch('/api/reservations?status=CONFIRMED');
    if (!res.ok) return;
    const all: Reservation[] = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    setNoShows(all.filter((r) => !r.room && r.checkInDate.slice(0, 10) < today));
  }, []);

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
    if (can(PERMISSIONS.RESERVATIONS_CANCEL)) loadNoShows();
  }, [loadStatus, loadRuns, loadTourism, loadNoShows, can]);

  async function retryTourism(id: string) {
    const res = await fetch(`/api/tourism/${id}/retry`, { method: 'POST' });
    setMsg(res.ok ? t('tourismRetrySent') : t('retryFailed'));
    await loadTourism();
  }

  const hasOpenShift = status?.openShift?.status === 'OPEN';

  async function openShift() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/cash/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashier: cashier || 'Cashier', registerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('failed'));
      setMsg(t('shiftOpened'));
      await loadStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tc('error'));
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/cash/shifts?action=close', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('failed'));
      setMsg(t('shiftClosed'));
      await loadStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tc('error'));
    } finally {
      setBusy(false);
    }
  }

  async function runNightAudit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/night-audit/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('failed'));
      setMsg(t('nightAuditResult', { status: data.run?.status ?? 'done' }));
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

  async function markNoShow(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noShow: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc('failed'));
      setMsg(t('noShowMarked', { name: data.guest?.fullName ?? id }));
      await loadNoShows();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tc('error'));
    } finally {
      setBusy(false);
    }
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
    <AppShell maxWidthClass="max-w-2xl">
      <PageHeader title={t('title')} />
      <StatusMessage>{msg}</StatusMessage>

      {can(PERMISSIONS.CASH_SHIFT) && (
        <PageSection className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('cashShift')}</h2>
          {hasOpenShift && status?.openShift ? (
            <div className="mb-3 text-[13px] text-amber-800">
              {t('openShiftDetail', {
                cashier: status.openShift.cashier,
                register: status.openShift.registerId,
                time: new Date(status.openShift.openedAt).toLocaleString(),
              })}
            </div>
          ) : (
            <p className="mb-3 text-[13px] text-[#7F8C8D]">{t('noOpenShift')}</p>
          )}
          {!hasOpenShift && (
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                placeholder={t('cashierPlaceholder')}
                className={MODAL_INPUT_CLASS}
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
              />
              <input
                placeholder={t('registerPlaceholder')}
                className={`w-28 ${MODAL_INPUT_CLASS}`}
                value={registerId}
                onChange={(e) => setRegisterId(e.target.value)}
              />
              <button type="button" disabled={busy} onClick={openShift} className={PRIMARY_BUTTON_CLASS}>
                {t('openShift')}
              </button>
            </div>
          )}
          {hasOpenShift && (
            <button type="button" disabled={busy} onClick={closeShift} className={SECONDARY_BUTTON_CLASS}>
              {t('closeShift')}
            </button>
          )}
        </PageSection>
      )}

      <PageSection className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('nightAudit')}</h2>
        <ul className="mb-4 space-y-1 text-[13px] text-[#7F8C8D]">
          <li>
            {t('inHouse')} {status?.inHouseCount ?? tc('dash')}
          </li>
          <li>
            {t('businessDay')} {status?.businessDay?.date?.slice(0, 10) ?? tc('dash')} (
            {status?.businessDay?.status ?? tc('dash')})
          </li>
          <li>
            {t('cashShiftStatus')}{' '}
            {hasOpenShift ? t('cashShiftOpenBlock') : t('cashShiftOk')}
          </li>
        </ul>
        {hasOpenShift && <p className="mb-3 text-[13px] text-rose-600">{t('closeShiftsBeforeNa')}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || hasOpenShift}
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
      </PageSection>

      {runs.length > 0 && (
        <PageSection className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-[#34495E]">{t('recentRuns')}</h2>
          <ul className="space-y-2 text-[13px] text-[#7F8C8D]">
            {runs.map((r) => (
              <li key={r.id}>
                {r.businessDay.date.slice(0, 10)} — {r.status} ({new Date(r.createdAt).toLocaleString()})
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      {tourismFailed.length > 0 && (
        <PageSection className="mb-6 border-amber-200 bg-amber-50">
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
        </PageSection>
      )}

      {can(PERMISSIONS.RESERVATIONS_CANCEL) && (
        <PageSection>
          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('noShowCandidates')}</h2>
          <ul className="space-y-2 text-[13px] text-[#34495E]">
            {noShows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {r.guest.fullName} — {t('due')} {r.checkInDate.slice(0, 10)}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => markNoShow(r.id)}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {t('markNoShow')}
                </button>
              </li>
            ))}
            {noShows.length === 0 && <li className="text-[#7F8C8D]">{tc('none')}</li>}
          </ul>
        </PageSection>
      )}
    </AppShell>
  );
}
