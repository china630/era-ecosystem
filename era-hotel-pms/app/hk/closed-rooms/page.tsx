'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  EraListFilterBar,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
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
  const [kindFilter, setKindFilter] = useState('');
  const [roomQuery, setRoomQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [kind, setKind] = useState('OOO');
  const [days, setDays] = useState('3');
  const [busy, setBusy] = useState(false);
  const [returnId, setReturnId] = useState<string | null>(null);

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

  const visible = useMemo(() => {
    const q = roomQuery.trim().toLowerCase();
    return rows.filter((r) => {
      const isOos = r.inventoryStatus === 'OOS';
      if (kindFilter === 'OOO' && isOos) return false;
      if (kindFilter === 'OOS' && !isOos) return false;
      if (q && !String(r.roomNumber).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, kindFilter, roomQuery]);

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

  async function returnToService(id: string) {
    setReturnId(id);
    const res = await fetch(`/api/housekeeping/closed-rooms/${id}/return`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setReturnId(null);
    if (!res.ok) showApiError(data, tc('failed'));
    else {
      showSuccess(tc('saved'));
      await load();
    }
  }

  function ymd(value: string | null | undefined) {
    return value ? String(value).slice(0, 10) : '—';
  }

  function kindLabel(status: string) {
    return status === 'OOS' ? t('kindOos') : t('kindOoo');
  }

  return (
    <>
      <PageHeader
        title={t('closedRoomsTitle')}
        subtitle={t('closedRoomsHint')}
        actions={
          canClose ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
              {t('closeRoom')}
            </button>
          ) : null
        }
      />
      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setKindFilter('');
          setRoomQuery('');
        }}
      >
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('kindFilter')}
          value={kindFilter}
          onChange={(v) => setKindFilter(String(v))}
          options={[
            { value: '', label: t('kindAll') },
            { value: 'OOO', label: t('kindOoo') },
            { value: 'OOS', label: t('kindOos') },
          ]}
        />
        <Field
          label={t('colRoom')}
          preset="shortText"
          value={roomQuery}
          onChange={(e) => setRoomQuery(e.target.value)}
        />
      </EraListFilterBar>
      <div className="overflow-x-auto rounded border border-[#D5DADF] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[12px] text-[#7F8C8D]">
              <th className="px-3 py-2">{t('colRoom')}</th>
              <th className="px-3 py-2">{t('kindFilter')}</th>
              <th className="px-3 py-2">{t('closedFrom')}</th>
              <th className="px-3 py-2">{t('closedTo')}</th>
              <th className="px-3 py-2">{t('closedReason')}</th>
              {canClose ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr className="border-b border-[#ECF0F1]">
                <td className="px-3 py-3 text-[#7F8C8D]" colSpan={canClose ? 6 : 5}>
                  {t('closedEmpty')}
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const c = r.closures?.[0];
                return (
                  <tr key={r.id} className="border-b border-[#ECF0F1]">
                    <td className="px-3 py-2 font-medium">{r.roomNumber}</td>
                    <td className="px-3 py-2">{kindLabel(r.inventoryStatus)}</td>
                    <td className="px-3 py-2">{ymd(c?.startDate)}</td>
                    <td className="px-3 py-2">{ymd(c?.endDate)}</td>
                    <td className="px-3 py-2">{r.inventoryReason ?? c?.reason ?? '—'}</td>
                    {canClose ? (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          disabled={returnId === r.id}
                          onClick={() => void returnToService(r.id)}
                        >
                          {t('returnToService')}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
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
