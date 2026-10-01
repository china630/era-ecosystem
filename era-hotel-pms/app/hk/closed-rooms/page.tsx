'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, PageHeader, PRIMARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Row = {
  id: string;
  roomNumber: string;
  inventoryStatus: string;
  inventoryReason: string | null;
  closures?: { startDate: string; endDate: string | null; reason: string | null }[];
};

export default function ClosedRoomsPage() {
  const t = useTranslations('housekeeping');
  const tc = useTranslations('common');
  const { can } = useAuth();
  const canClose = can(PERMISSIONS.HOUSEKEEPING_MANAGE);
  const [rows, setRows] = useState<Row[]>([]);
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string }>>([]);
  const [roomId, setRoomId] = useState('');
  const [kind, setKind] = useState('OOO');
  const [days, setDays] = useState('3');

  const load = useCallback(async () => {
    const [res, roomRes] = await Promise.all([
      fetch('/api/housekeeping/closed-rooms'),
      fetch('/api/rooms'),
    ]);
    if (roomRes.ok) {
      const list = await roomRes.json();
      setRooms(Array.isArray(list) ? list : []);
    }
    const json = await res.json();
    if (!res.ok) {
      showApiError(json, tc('loadError'));
      return;
    }
    setRows(Array.isArray(json) ? json : []);
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const ooo = rows.filter((r) => r.inventoryStatus === 'OOO');
  const oos = rows.filter((r) => r.inventoryStatus === 'OOS');

  function lane(title: string, list: Row[]) {
    return (
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">{title}</h2>
        <ul className="space-y-1 text-sm">
          {list.map((r) => {
            const c = r.closures?.[0];
            return (
              <li key={r.id}>
                {r.roomNumber} {c ? `· ${String(c.startDate).slice(0, 10)}–${c.endDate ? String(c.endDate).slice(0, 10) : '…'}` : ''}{' '}
                {r.inventoryReason ?? c?.reason ?? ''}
              </li>
            );
          })}
          {list.length === 0 ? <li className="text-[#7F8C8D]">{t('closedEmpty')}</li> : null}
        </ul>
      </section>
    );
  }

  return (
    <>
      <PageHeader title={t('closedRoomsTitle')} subtitle={canClose ? t('closeRoom') : undefined} />
      {canClose ? (
      <form
        className="mb-6 grid max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            const res = await fetch('/api/housekeeping/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId,
                days: Number(days),
                kind: kind === 'OOS' ? 'OOS' : 'OOO',
                notes: kind,
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) showApiError(data, tc('failed'));
            else {
              showSuccess(tc('saved'));
              await load();
            }
          })();
        }}
      >
        <CatalogField
          kind="ENTITY_REF"
          label={t('roomSelect')}
          value={roomId}
          onChange={(v) => setRoomId(String(v))}
          options={rooms.map((r) => ({ value: r.id, label: r.roomNumber }))}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('closeKind')}
          value={kind}
          onChange={(v) => setKind(String(v))}
          options={[
            { value: 'OOO', label: t('kindOoo') },
            { value: 'OOS', label: t('kindOos') },
          ]}
        />
        <label className="text-sm">
          {t('days')}
          <input
            type="number"
            min={1}
            className="ml-2 border px-2 py-1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={!roomId}>
          {t('closeRoom')}
        </button>
      </form>
      ) : null}
      {lane(t('oooLane'), ooo)}
      {lane(t('oosLane'), oos)}
    </>
  );
}
