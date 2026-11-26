import { fetchPoolOrganizationIdsFromOrch } from "@era/satellite-kit";

/** Public base URL of this hotel process (matches SatelliteEndpoint.baseUrl on orch). */
export function hotelPublicBaseUrl(): string {
  return (
    process.env.ERA_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://hotel.era-365.online"
  ).replace(/\/$/, "");
}

/** Orch SoR pool members for this hotel process URL. */
export function fetchHotelPoolOrganizationIds(): Promise<string[]> {
  return fetchPoolOrganizationIdsFromOrch({
    satelliteKey: "industry_hotel_pms",
    baseUrl: hotelPublicBaseUrl(),
  });
}
