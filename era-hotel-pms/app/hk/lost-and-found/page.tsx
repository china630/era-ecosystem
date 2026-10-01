'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CatalogField,
  DatePicker,
  Field,
  FieldTextarea,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { HotelDataGrid } from '@/components/HotelDataGrid';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDateKey } from '@/lib/hotel-calendar';

type Item = {
  id: string;
  foundDate: string;
  location: string;
  description: string;
  roomNumber: string | null;
  photoData: string | null;
  status: string;
};

const MAX_PHOTO = 1_200_000;

export default function LostAndFoundPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const guestId = searchParams.get('guestId');
  const t = useTranslations('lostAndFound');
  const tc = useTranslations('common');
  const [rows, setRows] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [foundDate, setFoundDate] = useState(() => hotelDateKey());
  const [roomNumber, setRoomNumber] = useState('');
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string }>>([]);
  const [photoData, setPhotoData] = useState('');

  const load = useCallback(async () => {
    const path = guestId
      ? `/api/housekeeping/lost-found?guestId=${encodeURIComponent(guestId)}`
      : '/api/housekeeping/lost-found';
    const res = await fetch(path);
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc('loadError'));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
    const roomRes = await fetch('/api/rooms');
    if (roomRes.ok) {
      const list = await roomRes.json();
      setRooms(Array.isArray(list) ? list : []);
    }
  }, [guestId, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!location.trim() || !description.trim()) {
      showApiError({ error: tc('required') });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/housekeeping/lost-found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foundDate,
          location,
          description,
          roomNumber: roomNumber.trim() || undefined,
          photoData: photoData || undefined,
          ...(guestId ? { guestId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      showSuccess(tc('saved'));
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch('/api/housekeeping/lost-found', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) showApiError(await res.json(), tc('failed'));
    else await load();
  }

  const canWrite = can(PERMISSIONS.HOUSEKEEPING_MANAGE);

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          canWrite ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setFoundDate(hotelDateKey());
                setLocation('');
                setDescription('');
                setRoomNumber('');
                setPhotoData('');
                setOpen(true);
              }}
            >
              {tc('add')}
            </button>
          ) : undefined
        }
      />
      <HotelDataGrid<Item>
        columns={[
          { key: 'foundDate', header: t('date'), render: (r) => String(r.foundDate).slice(0, 10) },
          { key: 'roomNumber', header: t('room'), render: (r) => r.roomNumber || '—' },
          { key: 'location', header: t('location') },
          { key: 'description', header: t('description') },
          {
            key: 'photoData',
            header: t('photo'),
            render: (r) =>
              r.photoData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.photoData} alt="" className="h-12 w-12 rounded object-cover" />
              ) : (
                '—'
              ),
          },
          {
            key: 'status',
            header: t('status'),
            render: (r) =>
              canWrite ? (
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t('status')}
                  value={r.status}
                  onChange={(v) => void setStatus(r.id, String(v))}
                  options={[
                    { value: 'OPEN', label: t('statusOpen') },
                    { value: 'RETURNED', label: t('statusReturned') },
                    { value: 'DISPOSED', label: t('statusDisposed') },
                  ]}
                />
              ) : (
                r.status
              ),
          },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage={t('empty')}
      />
      <ModalShell
        open={open}
        title={t('title')}
        onClose={() => !busy && setOpen(false)}
        closeLabel={tc('close')}
        footer={
          <ModalFooter
            onCancel={() => !busy && setOpen(false)}
            onSubmit={() => void save()}
            busy={busy}
            cancelLabel={tc('cancel')}
            submitLabel={tc('save')}
          />
        }
      >
        <div className="space-y-3">
          <DatePicker
            label={t('date')}
            value={foundDate}
            onChange={(next) => {
              if (next) setFoundDate(next);
            }}
            placeholder={tc('datePlaceholder')}
            preset="date"
          />
          <CatalogField
            kind="ENTITY_REF"
            label={t('room')}
            value={rooms.find((r) => r.roomNumber === roomNumber)?.id ?? ''}
            onChange={(v) => {
              const room = rooms.find((r) => r.id === String(v));
              setRoomNumber(room?.roomNumber ?? '');
            }}
            options={rooms.map((r) => ({ value: r.id, label: r.roomNumber }))}
          />
          <Field label={t('location')} preset="longText" value={location} onChange={(e) => setLocation(e.target.value)} required />
          <FieldTextarea label={t('description')} value={description} onChange={(e) => setDescription(e.target.value)} required />
          <label className="block text-sm text-[#34495E]">
            {t('photoHint')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 block text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  setPhotoData('');
                  return;
                }
                if (file.size > MAX_PHOTO) {
                  showApiError({ error: t('photoHint') }, tc('failed'));
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setPhotoData(String(reader.result ?? ''));
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
      </ModalShell>
    </>
  );
}
