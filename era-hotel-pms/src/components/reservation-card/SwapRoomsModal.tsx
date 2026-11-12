'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CatalogField, showApiError } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import {
  classSettlementChoices,
  doorTypeNeedsSettlement,
  type ClassSettlement,
} from '@/lib/room-move-settlement';

type InHouseStay = {
  id: string;
  isLocked?: boolean;
  roomTypeId: string;
  room: { roomNumber: string; roomTypeId: string } | null;
  guest: { fullName: string };
};

function settlementLabel(code: ClassSettlement, t: (key: string) => string) {
  if (code === 'HOTEL') return t('classHotelCovers');
  if (code === 'GUEST_PAY') return t('classGuestPays');
  if (code === 'HOTEL_REFUND') return t('classHotelRefund');
  return t('classGuestCheaper');
}

export function SwapRoomsModal({
  open,
  selfId,
  selfRoomNumber,
  selfChargedTypeId,
  selfDoorTypeId,
  priceForType,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  selfId: string;
  selfRoomNumber: string;
  selfChargedTypeId: string;
  selfDoorTypeId: string;
  priceForType: (roomTypeId: string) => number | null;
  onClose: () => void;
  onConfirm: (input: {
    otherReservationId: string;
    settlementA?: ClassSettlement;
    settlementB?: ClassSettlement;
  }) => void;
  busy?: boolean;
}) {
  const t = useTranslations('reservationCard');
  const tc = useTranslations('common');
  const [stays, setStays] = useState<InHouseStay[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [otherId, setOtherId] = useState('');
  const [settlementA, setSettlementA] = useState<ClassSettlement>('HOTEL');
  const [settlementB, setSettlementB] = useState<ClassSettlement>('HOTEL');

  useEffect(() => {
    if (!open) return;
    setOtherId('');
    setLoaded(false);
    void fetch('/api/reservations?status=IN_HOUSE')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          showApiError(json, tc('loadError'));
          return;
        }
        const rows = (Array.isArray(json) ? json : []) as InHouseStay[];
        setStays(rows.filter((row) => row.id !== selfId && row.room && !row.isLocked));
        setLoaded(true);
      })
      .catch((e) => {
        showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
        setLoaded(true);
      });
  }, [open, selfId, tc]);

  const other = stays.find((row) => row.id === otherId) ?? null;
  const askA = Boolean(
    other?.room && doorTypeNeedsSettlement(selfChargedTypeId, null, other.room.roomTypeId),
  );
  const askB = Boolean(
    other && doorTypeNeedsSettlement(other.roomTypeId, null, selfDoorTypeId),
  );
  const choicesA = classSettlementChoices(
    priceForType(selfChargedTypeId),
    other?.room ? priceForType(other.room.roomTypeId) : null,
  );
  const choicesB = classSettlementChoices(
    other ? priceForType(other.roomTypeId) : null,
    priceForType(selfDoorTypeId),
  );
  const choiceKey = `${choicesA.join(',')}|${choicesB.join(',')}`;

  useEffect(() => {
    if (!open) return;
    setSettlementA(choicesA[0] ?? 'HOTEL');
    setSettlementB(choicesB[0] ?? 'HOTEL');
    // choiceKey is the stable snapshot of the two price directions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, otherId, choiceKey]);

  const options = useMemo(
    () =>
      stays.map((row) => ({
        value: row.id,
        label: `${row.room?.roomNumber ?? '—'} · ${row.guest.fullName}`,
      })),
    [stays],
  );

  return (
    <EraModal
      open={open}
      title={t('swapRooms')}
      onClose={onClose}
      footer={
        <EraModalFooter
          onCancel={onClose}
          busy={busy}
          submitDisabled={busy || !otherId}
          submitLabel={t('confirmSwapRooms')}
          onSubmit={() =>
            onConfirm({
              otherReservationId: otherId,
              ...(askA ? { settlementA } : {}),
              ...(askB ? { settlementB } : {}),
            })
          }
        />
      }
    >
      <div className="space-y-3">
        <p className="m-0 text-[13px] text-[#34495E]">{t('swapRoomsHint')}</p>
        <CatalogField
          kind="SEARCHABLE"
          label={t('swapWithRoom')}
          value={otherId}
          onChange={(v) => setOtherId(String(v ?? ''))}
          options={options}
          emptyLabel={tc('select')}
        />
        {loaded && options.length === 0 ? (
          <p className="m-0 text-[13px] text-[#7F8C8D]">{t('swapRoomsEmpty')}</p>
        ) : null}
        {other?.room ? (
          <p className="m-0 text-[13px] text-[#34495E]">
            {t('swapPreview', {
              from: selfRoomNumber,
              to: other.room.roomNumber,
              guest: other.guest.fullName,
            })}
          </p>
        ) : null}
        {askA ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('swapSettlementSelf')}
            value={settlementA}
            onChange={(v) => setSettlementA(String(v ?? 'HOTEL') as ClassSettlement)}
            options={choicesA.map((code) => ({ value: code, label: settlementLabel(code, t) }))}
          />
        ) : null}
        {askB ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t('swapSettlementOther', { guest: other?.guest.fullName ?? '' })}
            value={settlementB}
            onChange={(v) => setSettlementB(String(v ?? 'HOTEL') as ClassSettlement)}
            options={choicesB.map((code) => ({ value: code, label: settlementLabel(code, t) }))}
          />
        ) : null}
      </div>
    </EraModal>
  );
}
