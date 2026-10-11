export type HotelRevenueCodeRow = { code: string; name: string };

function hotelBase(): string {
  return (
    process.env.HOTEL_PMS_URL?.trim() ||
    process.env.ERA_HOTEL_PMS_ORIGIN?.trim() ||
    "http://127.0.0.1:3201"
  ).replace(/\/$/, "");
}

/** Active hotel revenue codes (`code` is the key, `name` is the label). */
export async function listHotelRevenueCodes(
  organizationId: string,
): Promise<HotelRevenueCodeRow[]> {
  const org = organizationId.trim();
  if (!org) return [];
  const token =
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.POS_BRIDGE_SECRET?.trim() ||
    "";
  if (!token) return [];
  const url = new URL(`${hotelBase()}/api/internal/v1/revenue-codes`);
  url.searchParams.set("organizationId", org);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-service-token": token,
    },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return [];
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
