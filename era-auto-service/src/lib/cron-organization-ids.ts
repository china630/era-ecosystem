import { fetchPoolOrganizationIdsFromOrch } from "@era/satellite-kit";

export function fetchAutoPoolOrganizationIds(): Promise<string[]> {
  return fetchPoolOrganizationIdsFromOrch({
    satelliteKey: "industry_auto_service",
  });
}
