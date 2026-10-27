import {
  PEER_SATELLITE_HOTEL,
  resolvePeerSatelliteBaseUrl,
} from "../tenancy/resolve-peer-satellite-url";
import { resolveSatelliteEventServiceToken } from "../tenancy/resolve-orchestrator-url";

export type HotelRevenueCodeRow = { code: string; name: string };

export class HotelRevenueCatalogError extends Error {
  readonly code: "HOTEL_NOT_LINKED" | "HOTEL_TOKEN_MISSING" | "HOTEL_CATALOG_UNAVAILABLE";

  constructor(
    code: HotelRevenueCatalogError["code"],
    message: string,
  ) {
    super(message);
    this.name = "HotelRevenueCatalogError";
    this.code = code;
  }
}

async function hotelBaseForOrg(organizationId: string): Promise<string> {
  const peer = await resolvePeerSatelliteBaseUrl({
    organizationId,
    satelliteKey: PEER_SATELLITE_HOTEL,
  });
  return peer.baseUrl;
}

/** Active hotel revenue codes (`code` is the key, `name` is the label). */
export async function listHotelRevenueCodes(
  organizationId: string,
): Promise<HotelRevenueCodeRow[]> {
  const org = organizationId.trim();
  if (!org) {
    throw new HotelRevenueCatalogError("HOTEL_NOT_LINKED", "Hotel organization is not linked");
  }
  const token =
    resolveSatelliteEventServiceToken() ||
    process.env.POS_BRIDGE_SECRET?.trim() ||
    "";
  if (!token) {
    throw new HotelRevenueCatalogError(
      "HOTEL_TOKEN_MISSING",
      "Hotel service token is not configured",
    );
  }
  let base: string;
  try {
    base = await hotelBaseForOrg(org);
  } catch {
    throw new HotelRevenueCatalogError(
      "HOTEL_CATALOG_UNAVAILABLE",
      "Hotel peer URL is unavailable",
    );
  }
  const url = new URL(`${base}/api/internal/v1/revenue-codes`);
  url.searchParams.set("organizationId", org);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-service-token": token,
    },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) {
    throw new HotelRevenueCatalogError(
      "HOTEL_CATALOG_UNAVAILABLE",
      "Hotel revenue catalog is unavailable",
    );
  }
  const body = (await res.json()) as { codes?: HotelRevenueCodeRow[] };
  return (body.codes ?? []).filter((row) => row.code?.trim());
}

/** Key from the hotel list. A name match returns that row's code, never the name. */
export function resolveHotelRevenueKey(
  rows: readonly HotelRevenueCodeRow[],
  token: string | null | undefined,
): string | null {
  const key = token?.trim();
  if (!key) return null;
  const upper = key.toUpperCase();
  const byCode = rows.find((row) => row.code.trim().toUpperCase() === upper);
  if (byCode) return byCode.code;
  const byName = rows.find((row) => row.name.trim().toUpperCase() === upper);
  return byName?.code ?? null;
}
