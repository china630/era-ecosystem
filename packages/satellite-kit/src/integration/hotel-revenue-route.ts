/** Shared door for the hotel revenue-code picker. Exact path wins over any blanket admin rule. */

export const HOTEL_REVENUE_CODES_PATH = "/api/admin/hotel-revenue-codes";

export const HOTEL_REVENUE_CODES_PERMISSION = "api:hotel.revenue_codes";

export function sharedApiPermission(pathname: string): string | null {
  const path = (pathname.split("?")[0] ?? pathname).replace(/\/$/, "") || "/";
  if (path === HOTEL_REVENUE_CODES_PATH) return HOTEL_REVENUE_CODES_PERMISSION;
  return null;
}

/**
 * First non-empty hotel revenue key: product, then category, then the satellite default.
 * All three empty refuses the post.
 */
export function resolveHotelRevenueCode(input: {
  product?: string | null;
  category?: string | null;
  satellite?: string | null;
}): string {
  const code = [input.product, input.category, input.satellite]
    .map((value) => value?.trim() ?? "")
    .find((value) => value.length > 0);
  if (!code) throw new Error("Hotel revenue code is not configured");
  return code;
}
