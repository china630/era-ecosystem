/**
 * PMS → era-fb-pos lifecycle notifications (Stage 17).
 * No-op when FB_POS_WEBHOOK_URL is unset.
 */

export type PmsReservationLifecycleEvent = {
  eventType: 'reservation_checked_out' | 'reservation_cancelled' | 'folio_closed';
  reservationId: string;
  roomNumber?: string | null;
  timestamp: string;
};

export async function notifyFbPosReservationLifecycle(
  event: PmsReservationLifecycleEvent,
): Promise<void> {
  const base = process.env.FB_POS_WEBHOOK_URL?.replace(/\/$/, '');
  if (!base) return;

  const secret = process.env.POS_BRIDGE_SECRET;
  const url = `${base}/api/webhooks/pms/reservation-lifecycle`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Pos-Bridge-Secret': secret } : {}),
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('fb-pos webhook failed', res.status, text);
    }
  } catch (e) {
    console.error('fb-pos webhook error', e);
  }
}
