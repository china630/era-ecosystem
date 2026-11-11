/**
 * Same column rules as era-clinic/app/nurse/page.tsx `placeOrder`.
 * Queue holds slots still ahead. Check-in is drawn only while checkInOpen.
 * Seated PENDING_PAY stays on the board (red, no check-in) and ages to Late.
 * NO_SHOW stays in Late until the clinic day end.
 */

export type Place = "queue" | "progress" | "late" | "done";

export type BoardOrder = {
  status: string;
  scheduledAt: string;
  endsAt?: string | null;
  effectiveEndsAt?: string;
  checkInOpen?: boolean;
  checkInDeadline?: string;
};

export function placeOrder(
  order: BoardOrder,
  now: number,
  dayEnd: number,
  isToday: boolean,
): Place | null {
  if (order.status === "CHECKED_IN") return "progress";
  if (order.status === "COMPLETED") return "done";
  if (order.status === "NO_SHOW") {
    if (isToday && now >= dayEnd) return null;
    return "late";
  }
  if (order.status === "PENDING_PAY") {
    const start = new Date(order.scheduledAt).getTime();
    const endSrc = order.endsAt || order.effectiveEndsAt;
    const deadline = order.checkInDeadline
      ? new Date(order.checkInDeadline).getTime()
      : endSrc
        ? new Date(endSrc).getTime()
        : start;
    if (now < deadline) return "queue";
    return "late";
  }
  if (order.status !== "SCHEDULED") return null;
  if (order.checkInOpen) return "queue";
  const start = new Date(order.scheduledAt).getTime();
  const deadline = order.checkInDeadline
    ? new Date(order.checkInDeadline).getTime()
    : start;
  if (now < deadline) return "queue";
  return "late";
}

/** Repeat check-in of a row that already left SCHEDULED is success for the outbox. */
export type CheckInOutcome = "ok" | "retry" | "auth" | "terminal";

export function classifyCheckIn(status: number, code?: string): CheckInOutcome {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401) return "auth";
  if (status === 400 && code === "INVALID_TRANSITION") return "ok";
  if (status === 0 || status >= 500) return "retry";
  return "terminal";
}
