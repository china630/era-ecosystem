/**
 * HTTP client for era-hotel-pms bridge (doc/openapi/fnb-pos-pms-bridge.yaml).
 */

import { todayBakuYmd } from "@era/satellite-kit/time";

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
  warehouseCode?: string;
};

export type InHouseGuest = {
  reservationId: string;
  roomNumber: string;
  guestName: string;
  allowRoomCharge: boolean;
};

function bridgeHeaders(organizationId?: string): Record<string, string> {
  const secret = process.env.POS_BRIDGE_SECRET?.trim();
  if (!secret) throw new Error("POS_BRIDGE_SECRET is not configured");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Pos-Bridge-Secret": secret,
  };
  const org = organizationId?.trim();
  if (org) headers["x-era-organization-id"] = org;
  return headers;
}

async function pmsBaseUrl(organizationId?: string): Promise<string | null> {
  if (process.env.FB_POS_PMS_STUB === "1") return null;
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
  return process.env.FB_POS_PMS_STUB === "1";
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
        idempotent: false,
        chargeId: `stub-${idempotencyKey ?? crypto.randomUUID()}`,
        ...payload,
      },
    };
  }

  const { resolveOperatingMode, resolveSettlementPolicy } = await import("@era/satellite-kit");
  const { requestOrganizationId } = await import("@/lib/request-organization");
  const orgId = requestOrganizationId();
  const [mode, policy] = await Promise.all([
    resolveOperatingMode(orgId),
    resolveSettlementPolicy(orgId),
  ]);
  const hotelOrg = policy.hubOrganizationId?.trim() || mode.parentOrgId?.trim() || "";
  if (!hotelOrg) throw new Error("hotelOrganizationId required for hotel room charge");
  const base = await pmsBaseUrl(hotelOrg);
  if (!base) throw new Error("Hotel PMS peer URL is not configured");
  const headers: Record<string, string> = {
    ...bridgeHeaders(hotelOrg || undefined),
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${base}/api/pos/room-charge`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...payload,
      organizationId: hotelOrg,
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export type GuestEntitlements = {
  found: boolean;
  breakfastIncluded?: boolean;
  mealPlanCode?: string | null;
  allInclusive?: boolean;
};

export async function fetchGuestEntitlements(input: {
  roomNumber?: string;
  reservationId?: string;
}): Promise<GuestEntitlements | null> {
  if (isPmsStubMode()) {
    return { found: true, breakfastIncluded: true, mealPlanCode: 'BB', allInclusive: false };
  }
  const { requestOrganizationId } = await import("@/lib/request-organization");
  const base = await pmsBaseUrl(requestOrganizationId());
  if (!base) return null;
  const q = new URLSearchParams();
  if (input.roomNumber) q.set('roomNumber', input.roomNumber);
  if (input.reservationId) q.set('reservationId', input.reservationId);
  const res = await fetch(`${base}/api/pms/guest-entitlements?${q}`, {
    headers: bridgeHeaders(),
  });
  if (!res.ok) return null;
  return res.json() as Promise<GuestEntitlements>;
}

export type BuffetGuestNightDay = { date: string; pax: number };

/** Daily pax from hotel occupancy series for buffet guest-nights sync. */
export async function fetchBuffetGuestNightPax(args: {
  fromYmd: string;
  toYmd: string;
  organizationId?: string;
}): Promise<{ days: BuffetGuestNightDay[] } | null> {
  if (isPmsStubMode()) {
    return {
      days: [
        { date: args.fromYmd, pax: 40 },
        { date: args.toYmd, pax: 42 },
      ].filter((d, i, a) => a.findIndex((x) => x.date === d.date) === i),
    };
  }
  const { requestOrganizationId } = await import("@/lib/request-organization");
  const orgId = args.organizationId ?? requestOrganizationId();
  const base = await pmsBaseUrl(orgId);
  if (!base) return null;
  const q = new URLSearchParams({ from: args.fromYmd, to: args.toYmd });
  const res = await fetch(`${base}/api/pms/buffet-guest-nights?${q}`, {
    headers: bridgeHeaders(orgId),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as {
    days?: BuffetGuestNightDay[];
  } | null;
  if (!body || !Array.isArray(body.days)) return null;
  return {
    days: body.days.map((d) => ({
      date: String(d.date).slice(0, 10),
      pax: Math.max(0, Math.floor(Number(d.pax) || 0)),
    })),
  };
}

export async function listInHouseGuests(query?: string): Promise<InHouseGuest[]> {
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

  const { requestOrganizationId } = await import("@/lib/request-organization");
  const base = await pmsBaseUrl(requestOrganizationId());
  if (!base) return [];
  const params = query ? `?query=${encodeURIComponent(query)}` : "";
  const res = await fetch(`${base}/api/pms/in-house${params}`, {
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
  closedAt?: string;
}): Promise<void> {
  if (isPmsStubMode()) return;
  // Lazy: the kit barrel pulls jose, and a static import breaks CJS Jest on /api/health.
  const { requestOrganizationId } = await import("@/lib/request-organization");
  const { resolveCatalogOrganizationId } = await import("@era/satellite-kit");
  const organizationId = await resolveCatalogOrganizationId(requestOrganizationId());
  const base = await pmsBaseUrl(organizationId);
  if (!base) throw new Error("Hotel PMS peer URL is not configured");
  const res = await fetch(`${base}/api/pms/pos-shift-status`, {
    method: "PUT",
    headers: bridgeHeaders(organizationId),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Hotel did not record POS shift ${payload.status} for ${payload.outletCode}`);
  }
}

export type ActiveBanquetEvent = {
  id: string;
  eventName: string;
  eventDate: string;
  pax: number;
  status: string;
  referenceNo?: string | null;
};

export async function listActiveBanquets(): Promise<ActiveBanquetEvent[]> {
  if (isPmsStubMode()) {
    const today = todayBakuYmd();
    return [
      {
        id: "00000000-0000-4000-8000-beo000001",
        eventName: "Wedding reception",
        eventDate: today,
        pax: 120,
        status: "CONFIRMED",
        referenceNo: "BQ-2026-001",
      },
      {
        id: "00000000-0000-4000-8000-beo000002",
        eventName: "Corporate lunch",
        eventDate: today,
        pax: 45,
        status: "CONFIRMED",
        referenceNo: "BQ-2026-002",
      },
    ];
  }

  const { requestOrganizationId } = await import("@/lib/request-organization");
  const base = await pmsBaseUrl(requestOrganizationId());
  if (!base) return [];

  const today = todayBakuYmd();
  const res = await fetch(
    `${base}/api/banquets?status=CONFIRMED&from=${today}&to=${today}`,
    { headers: bridgeHeaders(), cache: "no-store" },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as { events?: ActiveBanquetEvent[] };
  return Array.isArray(data.events) ? data.events : [];
}
