import { fetchPoolOrganizationIdsFromOrch } from "@era/satellite-kit";

export function fetchClinicPoolOrganizationIds(): Promise<string[]> {
  return fetchPoolOrganizationIdsFromOrch({
    satelliteKey: "industry_clinic",
  });
}
