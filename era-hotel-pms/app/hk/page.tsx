'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
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

  const load = useCallback(async () => {
    const [tRes, rRes] = await Promise.all([
      fetch('/api/housekeeping/tasks'),
      fetch('/api/rooms'),
    ]);
    if (tRes.ok) setTasks(await tRes.json());
    else showApiError(await tRes.json(), tc('loadError'));
    if (rRes.ok) setRooms(await rRes.json());
  }, [tc]);

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
