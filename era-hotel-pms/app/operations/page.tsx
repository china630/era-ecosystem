'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import AppNav from '@/components/AppNav';
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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <AppNav />
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      {msg && <p className="mb-4 text-sm text-slate-300">{msg}</p>}

      {can(PERMISSIONS.CASH_SHIFT) && (
        <section className="mb-8 rounded-xl border border-slate-700 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('cashShift')}</h2>
          {hasOpenShift && status?.openShift ? (
            <div className="mb-3 text-sm text-amber-200">
              {t('openShiftDetail', {
                cashier: status.openShift.cashier,
                register: status.openShift.registerId,
                time: new Date(status.openShift.openedAt).toLocaleString(),
              })}
            </div>
          ) : (
            <p className="mb-3 text-sm text-slate-400">{t('noOpenShift')}</p>
          )}
          {!hasOpenShift && (
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                placeholder={t('cashierPlaceholder')}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
              />
              <input
                placeholder={t('registerPlaceholder')}
                className="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
                value={registerId}
                onChange={(e) => setRegisterId(e.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={openShift}
                className="rounded bg-emerald-700 px-3 py-1 text-sm disabled:opacity-50"
              >
                {t('openShift')}
              </button>
            </div>
          )}
          {hasOpenShift && (
            <button
              type="button"
              disabled={busy}
              onClick={closeShift}
              className="rounded bg-rose-800 px-3 py-2 text-sm disabled:opacity-50"
            >
              {t('closeShift')}
            </button>
          )}
        </section>
      )}

      <section className="mb-8 rounded-xl border border-slate-700 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('nightAudit')}</h2>
        <ul className="mb-4 space-y-1 text-xs text-slate-400">
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
        {hasOpenShift && (
          <p className="mb-3 text-sm text-rose-300">{t('closeShiftsBeforeNa')}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || hasOpenShift}
            onClick={runNightAudit}
            className="rounded bg-indigo-700 px-3 py-2 text-sm disabled:opacity-50"
          >
            {t('runNightAudit')}
          </button>
          <button
            type="button"
            onClick={retryEvents}
            className="rounded border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
          >
            {t('processRetry')}
          </button>
        </div>
        {lastSteps.length > 0 && (
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-slate-300">
            {lastSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </section>

      {runs.length > 0 && (
        <section className="mb-8 rounded-xl border border-slate-700 p-4">
          <h2 className="mb-2 text-sm font-medium uppercase text-slate-500">{t('recentRuns')}</h2>
          <ul className="space-y-2 text-xs text-slate-400">
            {runs.map((r) => (
              <li key={r.id}>
                {r.businessDay.date.slice(0, 10)} — {r.status} ({new Date(r.createdAt).toLocaleString()})
              </li>
            ))}
          </ul>
        </section>
      )}

      {tourismFailed.length > 0 && (
        <section className="mb-8 rounded-xl border border-amber-900/50 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase text-amber-500">{t('tourismRegistry')}</h2>
          <ul className="space-y-2 text-sm">
            {tourismFailed.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {row.reservation.guest.fullName} — {row.eventKind}:{' '}
                  {row.errorMessage ?? tc('failedStatus')}
                </span>
                <button
                  type="button"
                  onClick={() => retryTourism(row.id)}
                  className="rounded bg-amber-800 px-2 py-1 text-xs"
                >
                  {tc('retry')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {can(PERMISSIONS.RESERVATIONS_CANCEL) && (
        <section className="rounded-xl border border-slate-700 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase text-slate-500">{t('noShowCandidates')}</h2>
          <ul className="space-y-2 text-sm">
            {noShows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {r.guest.fullName} — {t('due')} {r.checkInDate.slice(0, 10)}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => markNoShow(r.id)}
                  className="rounded bg-rose-800 px-2 py-1 text-xs disabled:opacity-50"
                >
                  {t('markNoShow')}
                </button>
              </li>
            ))}
            {noShows.length === 0 && <li className="text-slate-500">{tc('none')}</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
