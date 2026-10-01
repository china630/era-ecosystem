import { fetchPoolOrganizationIdsFromOrch } from "@era/satellite-kit";

/** Orch SoR pool members for this hotel process URL. */
export function fetchHotelPoolOrganizationIds(): Promise<string[]> {
  return fetchPoolOrganizationIdsFromOrch({
    satelliteKey: "industry_hotel_pms",
  });
}
