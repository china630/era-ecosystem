/**
 * HTTP client for era-hotel-pms bridge (doc/openapi/fb-pos-pms-bridge.yaml).
 */

export type RoomChargePayload = {
  roomNumber: string;
  revenueCode: string;
  amount: number;
  description: string;
  outletCode: string;
  externalTicketId?: string;
};

export type InHouseGuest = {
  reservationId: string;
  roomNumber: string;
  guestName: string;
  allowRoomCharge: boolean;
};

function bridgeHeaders(): HeadersInit {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) throw new Error("POS_BRIDGE_SECRET is not configured");
  return {
    "Content-Type": "application/json",
    "X-Pos-Bridge-Secret": secret,
  };
}

function pmsBaseUrl(): string {
  const url = process.env.PMS_BRIDGE_URL ?? "http://127.0.0.1:3000";
  return url.replace(/\/$/, "");
}

export async function postRoomCharge(
  payload: RoomChargePayload,
  idempotencyKey?: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const headers: Record<string, string> = {
    ...(bridgeHeaders() as Record<string, string>),
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${pmsBaseUrl()}/api/pos/room-charge`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function listInHouseGuests(): Promise<InHouseGuest[]> {
  const res = await fetch(`${pmsBaseUrl()}/api/pms/in-house`, {
    headers: bridgeHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json() as Promise<InHouseGuest[]>;
}

export async function reportPosShiftStatus(payload: {
  outletCode: string;
  status: "OPEN" | "CLOSED";
  shiftId?: string;
}): Promise<void> {
  await fetch(`${pmsBaseUrl()}/api/pms/pos-shift-status`, {
    method: "PUT",
    headers: bridgeHeaders(),
    body: JSON.stringify(payload),
  });
}
