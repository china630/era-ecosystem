'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  EraListFilterBar,
  FieldSelect,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface Task {
  id: string;
  status: string;
  notes: string | null;
  room: { id: string; roomNumber: string; status: string; roomType: { code: string } };
}

interface Room {
  id: string;
  roomNumber: string;
  status: string;
  roomType: { code: string };
}

type HkFilter = 'all' | 'pending' | 'dirty' | 'clean';

export default function HousekeepingPage() {
  const { can } = useAuth();
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const tRoom = useTranslations('roomStatus');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [oooRoomId, setOooRoomId] = useState('');
  const [oooDays, setOooDays] = useState('3');
  const [msg, setMsg] = useState<string | null>(null);
  const [oooModalOpen, setOooModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<HkFilter>('all');
  const [sheetFloor, setSheetFloor] = useState('2');
  const [sheetRows, setSheetRows] = useState<Array<Record<string, unknown>>>([]);
  const [printPages, setPrintPages] = useState<Array<{ floor: number; rows: Array<Record<string, unknown>> }>>([]);
  const [sheetDate] = useState(() => new Date().toISOString().slice(0, 10));
  const OUTCOMES = ['V', 'VC', 'OK', 'REFUSED', 'DND', 'SO'] as const;

  const load = useCallback(async () => {
    const [tRes, rRes, sRes] = await Promise.all([
      fetch('/api/housekeeping/tasks'),
      fetch('/api/rooms'),
      fetch(`/api/housekeeping/sheet?floor=${sheetFloor}`),
    ]);
    if (tRes.ok) setTasks(await tRes.json());
    else showApiError(await tRes.json(), tc('loadError'));
    if (rRes.ok) setRooms(await rRes.json());
    if (sRes.ok) setSheetRows(await sRes.json());
  }, [tc, sheetFloor]);

  useEffect(() => {
    void load();
  }, [load]);

  const oooFormId = 'ooo-form';

  async function completeTask(taskId: string) {
    const res = await fetch('/api/housekeeping/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });
    const data = await res.json();
    const status = data.room?.status as string | undefined;
    setMsg(
      res.ok
        ? t('taskDone', { status: status ? tRoom(status as 'CLEAN') : status ?? tc('dash') })
        : data.error,
    );
    await load();
  }

  async function markInspected(roomId: string) {
    const res = await fetch(`/api/rooms/${roomId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'INSPECTED' }),
    });
    const data = await res.json();
    setMsg(res.ok ? t('roomInspected', { room: data.roomNumber }) : data.error);
    await load();
  }

  async function setOoo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/housekeeping/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: oooRoomId, days: parseInt(oooDays, 10), notes: 'OOO from HK' }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? t('roomOoo', { room: data.roomNumber }) : data.error);
    if (res.ok) {
      setOooModalOpen(false);
      setOooRoomId('');
    }
    await load();
  }

  const dirtyRooms = rooms.filter((r) => r.status === 'DIRTY');
  const cleanRooms = rooms.filter((r) => r.status === 'CLEAN');
  const pendingTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'DONE'),
    [tasks],
  );

  const showPending = filter === 'all' || filter === 'pending';
  const showClean = filter === 'all' || filter === 'clean';
  const showDirty = filter === 'all' || filter === 'dirty';

  if (!can(PERMISSIONS.HOUSEKEEPING_MANAGE) && !can(PERMISSIONS.ROOMS_STATUS)) {
    return (
      <p className="text-[13px] text-[#7F8C8D]">{tc('noPermissionHousekeeping')}</p>
    );
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('hint')}
        actions={
          can(PERMISSIONS.HOUSEKEEPING_MANAGE) ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOooModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('setOoo')}
            </button>
          ) : undefined
        }
      />
      {msg ? (
        <p className="mb-4 rounded-lg border border-[#D5DADF] bg-white px-4 py-2 text-[13px] text-[#34495E]">
          {msg}
        </p>
      ) : null}

      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => setFilter('all')}
      >
        <FieldSelect
          label={t('filterStatus')}
          preset="select"
          value={filter}
          onChange={(e) => setFilter(e.target.value as HkFilter)}
        >
          <option value="all">{t('filterAll')}</option>
          <option value="pending">{t('filterPending')}</option>
          <option value="dirty">{t('filterDirty')}</option>
          <option value="clean">{t('filterClean')}</option>
        </FieldSelect>
      </EraListFilterBar>
      <p className="mb-4 text-[12px] text-[#7F8C8D]">{t('statusActionsHint')}</p>

      <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6 print:shadow-none`} id="hk-floor-sheet">
        <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
          <h2 className="text-sm font-semibold">{t('sheetTitle')}</h2>
          <input
            type="number"
            className={MODAL_INPUT_CLASS}
            style={{ width: 80 }}
            value={sheetFloor}
            onChange={(e) => setSheetFloor(e.target.value)}
          />
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={async () => {
              const res = await fetch(`/api/housekeeping/sheet?all=1&date=${sheetDate}`);
              if (res.ok) setPrintPages(await res.json());
              window.print();
            }}
          >
            {t('printSheet')}
          </button>
        </div>
        {(printPages.length ? printPages : [{ floor: Number(sheetFloor), rows: sheetRows }]).map((page) => (
          <div key={page.floor} className="hk-print-floor" style={{ pageBreakAfter: 'always' }}>
            <p className="mb-1 hidden text-xs print:block">
              {t('sheetTitle')} · {t('floor')} {page.floor} · {sheetDate} · {t('inList')}: {page.rows.length}
            </p>
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  <th>{t('colRoom')}</th>
                  <th>HK</th>
                  <th>{t('colOcc')}</th>
                  <th>{t('colType')}</th>
                  <th>{t('colMaid')}</th>
                  <th>{t('floor')}</th>
                  <th>{t('colLoc')}</th>
                  <th>{t('colGuest')}</th>
                  <th>VIP</th>
                  <th>{t('colAgency')}</th>
                  <th>{t('colArrive')}</th>
                  <th>{t('colDepart')}</th>
                  <th>{t('colAdults')}</th>
                  <th>{t('colChild')}</th>
                  <th>{t('colJob')}</th>
                  <th>{t('colDuty')}</th>
                  <th>{t('colNat')}</th>
                  <th>{t('colExtra')}</th>
                  <th>{t('colTodayArr')}</th>
                  <th>{t('colTodayDep')}</th>
                  <th>Q</th>
                  <th className="print:hidden">{t('neededBy')}</th>
                  <th className="print:hidden">{t('outcome')}</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((r) => (
                  <tr key={String(r.roomId)} className="break-inside-avoid">
                    <td>{String(r.roomNumber)}</td>
                    <td>{String(r.hkCondition ?? r.status)}</td>
                    <td>{String(r.occupancy ?? '')}</td>
                    <td>{String(r.roomType)}</td>
                    <td>{String(r.maidName)}</td>
                    <td>{String(r.floor)}</td>
                    <td>{String(r.location)}</td>
                    <td>{String(r.guests)}</td>
                    <td>{String(r.vip)}</td>
                    <td>{String(r.agency)}</td>
                    <td>{String(r.arrival)}</td>
                    <td>{String(r.departure)}</td>
                    <td>{String(r.adults)}</td>
                    <td>{String(r.children)}</td>
                    <td>{String(r.jobType)}</td>
                    <td>{String(r.jobDuty ?? '')}</td>
                    <td>{String(r.nationality)}</td>
                    <td>{String(r.extraPax ?? 0)}</td>
                    <td>{String(r.todayArrivalPax ?? 0)}</td>
                    <td>{String(r.todayDepartPax ?? 0)}</td>
                    <td>{String(r.qHour ?? '')}</td>
                    <td className="print:hidden">
                      <input
                        type="time"
                        className={MODAL_INPUT_CLASS}
                        defaultValue={
                          r.neededByAt
                            ? String(r.neededByAt).slice(11, 16)
                            : ''
                        }
                        onBlur={(e) => {
                          const time = e.target.value;
                          if (!time) return;
                          void fetch('/api/housekeeping/needed-by', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ roomId: r.roomId, date: sheetDate, time }),
                          }).then(() => load());
                        }}
                      />
                    </td>
                    <td className="print:hidden">
                      {r.reservationId ? (
                        <div className="flex flex-col gap-1">
                          <CatalogField
                            kind="CLOSED_SMALL"
                            label={t('outcome')}
                            value=""
                            onChange={(v) => {
                              void fetch('/api/housekeeping/outcome', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  roomId: r.roomId,
                                  date: sheetDate,
                                  outcome: v,
                                }),
                              }).then(() => load());
                            }}
                            options={OUTCOMES.map((o) => ({
                              value: o,
                              label: o === 'REFUSED' ? t('refused') : o,
                            }))}
                          />
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            onClick={() => {
                              void fetch('/api/housekeeping/nsr', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  reservationId: r.reservationId,
                                  roomId: r.roomId,
                                  date: sheetDate,
                                }),
                              }).then(() => load());
                            }}
                          >
                            {t('nsr')}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      {showPending ? (
        <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6`}>
          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('pendingTasks')}</h2>
          <ul className="space-y-2 text-[13px] text-[#34495E]">
            {pendingTasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {task.room.roomNumber} ({task.room.roomType.code}) —{' '}
                  {t('taskStatusLabel', { status: task.status })} ·{' '}
                  {tRoom(task.room.status as 'DIRTY')}
                </span>
                {can(PERMISSIONS.HOUSEKEEPING_MANAGE) && (
                  <button
                    type="button"
                    onClick={() => completeTask(task.id)}
                    className={SECONDARY_BUTTON_CLASS}
                  >
                    {t('completeClean')}
                  </button>
                )}
              </li>
            ))}
            {pendingTasks.length === 0 && (
              <li className="text-[#7F8C8D]">{t('noOpenTasks')}</li>
            )}
          </ul>
        </section>
      ) : null}

      {showClean && can(PERMISSIONS.ROOMS_STATUS) && cleanRooms.length > 0 ? (
        <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6`}>
          <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t('markInspected')}</h2>
          <ul className="flex flex-wrap gap-2">
            {cleanRooms.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => markInspected(r.id)} className={SECONDARY_BUTTON_CLASS}>
                  {t('roomToInspected', { room: r.roomNumber })}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showDirty && dirtyRooms.length > 0 ? (
        <section className={`${CARD_CONTAINER_CLASS} p-4 mb-6 border-amber-200 bg-amber-50 text-[13px] text-amber-900`}>
          {t('dirtyWithoutTask')} {dirtyRooms.map((r) => r.roomNumber).join(', ')}
        </section>
      ) : null}

      <EraModal
        open={oooModalOpen}
        title={t('outOfOrder')}
        onClose={() => setOooModalOpen(false)}
        footer={
          <EraModalFooter formId={oooFormId} onCancel={() => setOooModalOpen(false)} busy={busy} submitLabel={t('setOoo')} />
        }
      >
        <form id={oooFormId} onSubmit={setOoo} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ooo-room">
              {t('roomSelect')}
            </label>
            <select
              id="ooo-room"
              className={MODAL_INPUT_CLASS}
              value={oooRoomId}
              onChange={(e) => setOooRoomId(e.target.value)}
              required
            >
              <option value="">{t('roomSelect')}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} ({tRoom(r.status as 'DIRTY')})
                </option>
              ))}
            </select>
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ooo-days">
              {t('days')}
            </label>
            <input
              id="ooo-days"
              type="number"
              min={1}
              className={MODAL_INPUT_CLASS}
              value={oooDays}
              onChange={(e) => setOooDays(e.target.value)}
            />
          </div>
        </form>
      </EraModal>
    </>
  );
}
