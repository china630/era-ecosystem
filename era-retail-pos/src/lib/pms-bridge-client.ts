/** HTTP client for era-hotel-pms POS bridge (room charge to guest folio). */

export type RoomChargePayload = {
  reservationId?: string;
  roomNumber?: string;
  revenueCode: string;
  amount: number;
  description: string;
  outletCode: string;
  externalTicketId?: string;
  productSku?: string;
  qty?: number;
};

export type HotelPendingPayload = {
  sourceRef: string;
  amount: number;
  description: string;
  payerLabel?: string;
  idempotencyKey: string;
  sku: string;
  qty: number;
  revenueCode: string;
};

function bridgeHeaders(hotelOrganizationId?: string): Record<string, string> {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) throw new Error("POS_BRIDGE_SECRET is not configured");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Pos-Bridge-Secret": secret,
  };
  if (hotelOrganizationId?.trim()) {
    headers["x-era-organization-id"] = hotelOrganizationId.trim();
  }
  return headers;
}

export async function hotelOrganizationId(): Promise<string> {
  const { resolveOperatingMode, resolveSettlementPolicy } = await import("@era/satellite-kit");
  const { requestOrganizationId } = await import("@/lib/request-organization");
  const orgId = requestOrganizationId();
  const [mode, policy] = await Promise.all([
    resolveOperatingMode(orgId),
    resolveSettlementPolicy(orgId),
  ]);
  const hotelOrg = policy.hubOrganizationId?.trim() || mode.parentOrgId?.trim() || "";
  if (!hotelOrg) throw new Error("hotelOrganizationId required for hotel charge");
  return hotelOrg;
}

async function pmsBaseUrl(organizationId?: string): Promise<string | null> {
  if (process.env.RETAIL_PMS_STUB === "1") return null;
  const org = organizationId?.trim();
  if (org) {
    try {
      const { PEER_SATELLITE_HOTEL, resolvePeerSatelliteBaseUrl } = await import(
        "@era/satellite-kit"
      );
      const peer = await resolvePeerSatelliteBaseUrl({
        organizationId: org,
        satelliteKey: PEER_SATELLITE_HOTEL,
      });
      return peer.baseUrl;
    } catch {
      /* env bootstrap below */
    }
  }
  const url = process.env.HOTEL_PMS_URL ?? process.env.PMS_BRIDGE_URL;
  if (!url?.trim()) return null;
  return url.replace(/\/$/, "");
}

export function isPmsStubMode(): boolean {
  return process.env.RETAIL_PMS_STUB === "1";
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

  const hotelOrg = await hotelOrganizationId();
  const base = await pmsBaseUrl(hotelOrg);
  if (!base) throw new Error("Hotel PMS peer URL is not configured");
  const headers: Record<string, string> = {
    ...bridgeHeaders(hotelOrg),
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${base}/api/pos/room-charge`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...payload, organizationId: hotelOrg }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function postHotelSettlementPending(
  payload: HotelPendingPayload,
): Promise<{ id: string }> {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) throw new Error("POS_BRIDGE_SECRET is not configured");
  const { requestOrganizationId } = await import("@/lib/request-organization");
  const hotelOrg = await hotelOrganizationId();
  const base = (await pmsBaseUrl(hotelOrg)) ?? "";
  if (!base) throw new Error("Hotel PMS peer URL is not configured");
  const res = await fetch(`${base}/api/settlement/pending`, {
    method: "POST",
    headers: {
      ...bridgeHeaders(hotelOrg),
      Authorization: `Bearer ${secret}`,
      "Idempotency-Key": payload.idempotencyKey,
    },
    body: JSON.stringify({
      sourceSystem: "RETAIL",
      sourceOrgId: requestOrganizationId(),
      hotelOrganizationId: hotelOrg,
      sourceRef: payload.sourceRef,
      amount: payload.amount,
      description: payload.description,
      payerLabel: payload.payerLabel,
      sku: payload.sku,
      qty: payload.qty,
      revenueCode: payload.revenueCode,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hotel pending charge failed: ${res.status} ${text}`);
  }
  const body = (await res.json()) as { id?: string; data?: { id?: string } };
  const id = body.id ?? body.data?.id;
  if (!id) throw new Error("Hotel pending charge returned no id");
  return { id };
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
  const hotelOrg = await hotelOrganizationId().catch(() => "");
  const base = await pmsBaseUrl(hotelOrg || undefined);
  if (!base) return [];
  const params = query ? `?query=${encodeURIComponent(query)}` : "";
  const res = await fetch(`${base}/api/pms/in-house${params}`, {
    headers: bridgeHeaders(hotelOrg || undefined),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}
