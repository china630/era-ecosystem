/** HTTP client for era-hotel-pms POS bridge (room charge to guest folio). */

export type RoomChargePayload = {
  reservationId?: string;
  roomNumber?: string;
  revenueCode: string;
  amount: number;
  description: string;
  outletCode: string;
  externalTicketId?: string;
};

function bridgeHeaders(): HeadersInit {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) throw new Error("POS_BRIDGE_SECRET is not configured");
  return {
    "Content-Type": "application/json",
    "X-Pos-Bridge-Secret": secret,
  };
}

function pmsBaseUrl(): string | null {
  const url = process.env.HOTEL_PMS_URL ?? process.env.PMS_BRIDGE_URL;
  if (!url?.trim()) return null;
  return url.replace(/\/$/, "");
}

export function isPmsStubMode(): boolean {
  return !pmsBaseUrl() || process.env.RETAIL_PMS_STUB === "1";
}

export async function postRoomCharge(
  payload: RoomChargePayload,
  idempotencyKey?: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  if (isPmsStubMode()) {
    return {
      ok: true,
      status: 201,
      body: {
        stub: true,
        chargeId: `stub-${idempotencyKey ?? crypto.randomUUID()}`,
        ...payload,
      },
    };
  }

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

export async function listInHouseGuests(query?: string) {
  if (isPmsStubMode()) {
    if (!query) return [];
    return [
      {
        reservationId: "00000000-0000-4000-8000-000000000201",
        roomNumber: query.replace(/\D/g, "") || query,
        guestName: "Stub Guest",
        allowRoomCharge: true,
      },
    ];
  }
  const params = query ? `?query=${encodeURIComponent(query)}` : "";
  const res = await fetch(`${pmsBaseUrl()}/api/pms/in-house${params}`, {
    headers: bridgeHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}
