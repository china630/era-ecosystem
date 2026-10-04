'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, Field, PageHeader, PRIMARY_BUTTON_CLASS, showApiError, showSuccess } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
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
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [kind, setKind] = useState('OOO');
  const [days, setDays] = useState('3');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [res, roomRes] = await Promise.all([fetch('/api/housekeeping/closed-rooms'), fetch('/api/rooms')]);
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

  async function closeRoom(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
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
    setBusy(false);
    if (!res.ok) showApiError(data, tc('failed'));
    else {
      showSuccess(tc('saved'));
      setOpen(false);
      setRoomId('');
      await load();
    }
  }

  function ymd(value: string | null | undefined) {
    return value ? String(value).slice(0, 10) : '—';
  }

  return (
    <>
      <PageHeader
        title={t('closedRoomsTitle')}
        actions={
          canClose ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
              {t('closeRoom')}
            </button>
          ) : null
        }
      />
      {rows.length === 0 ? <p className="text-sm text-[#7F8C8D]">{t('closedEmpty')}</p> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded border border-[#D5DADF] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
                <th className="px-3 py-2">{t('colRoom')}</th>
                <th className="px-3 py-2">{t('closeKind')}</th>
                <th className="px-3 py-2">{t('closedFrom')}</th>
                <th className="px-3 py-2">{t('closedTo')}</th>
                <th className="px-3 py-2">{t('closedReason')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = r.closures?.[0];
                return (
                  <tr key={r.id} className="border-b border-[#ECF0F1]">
                    <td className="px-3 py-2 font-medium">{r.roomNumber}</td>
                    <td className="px-3 py-2">{r.inventoryStatus === 'OOS' ? t('kindOos') : t('kindOoo')}</td>
                    <td className="px-3 py-2">{ymd(c?.startDate)}</td>
                    <td className="px-3 py-2">{ymd(c?.endDate)}</td>
                    <td className="px-3 py-2">{r.inventoryReason ?? c?.reason ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <EraModal
        open={open}
        title={t('closeRoom')}
        onClose={() => setOpen(false)}
        footer={<EraModalFooter formId="close-room" onCancel={() => setOpen(false)} busy={busy} submitLabel={t('closeRoom')} />}
      >
        <form id="close-room" onSubmit={closeRoom} className="space-y-3">
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
          <Field label={t('days')} preset="amount" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
        </form>
      </EraModal>
    </>
  );
}
