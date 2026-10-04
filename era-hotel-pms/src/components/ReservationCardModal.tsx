'use client';

import { useEffect, useState } from 'react';
import { ReservationCardEditor } from '@/components/reservation-card/ReservationCardEditor';
import type { TabId } from '@/components/reservation-card/types';

export default function ReservationCardModal({
  open,
  onClose,
  reservationId: reservationIdProp,
  initialTab = 'guests',
}: {
  open: boolean;
  onClose: () => void;
  reservationId?: string | null;
  initialTab?: TabId;
}) {
  const [editId, setEditId] = useState<string | null>(reservationIdProp ?? null);

  useEffect(() => {
    if (open) setEditId(reservationIdProp ?? null);
  }, [open, reservationIdProp]);

  return (
    <ReservationCardEditor
      layout="modal"
      open={open}
      onClose={onClose}
      reservationId={editId}
      initialTab={initialTab}
      onReservationCreated={(id) => setEditId(id)}
    />
  );
}
