'use client';

import { useState } from 'react';
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
  const propId = reservationIdProp ?? null;
  const [editId, setEditId] = useState<string | null>(propId);
  const [seenOpen, setSeenOpen] = useState(open);
  const [seenPropId, setSeenPropId] = useState(propId);

  // Apply the open/id change before children paint, so a new booking never
  // loads the card that was closed a moment earlier. A create that just saved
  // keeps its local id: the prop stays null and this does not reset it.
  if (open !== seenOpen || propId !== seenPropId) {
    setSeenOpen(open);
    setSeenPropId(propId);
    setEditId(open ? propId : null);
  }

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
