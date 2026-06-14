'use client';

import { useEffect, useState } from 'react';
import { ReservationCardEditor } from '@/components/reservation-card/ReservationCardEditor';

export default function ReservationCardModal({
  open,
  onClose,
  reservationId: reservationIdProp,
}: {
  open: boolean;
  onClose: () => void;
  reservationId?: string | null;
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
      onReservationCreated={(id) => setEditId(id)}
    />
  );
}
