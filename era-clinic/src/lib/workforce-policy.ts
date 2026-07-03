import { fetchWorkforcePolicy, isCpWorkforceHireMode } from "@era/satellite-kit";

export const CLINIC_SATELLITE_KEY = "industry_clinic";

export async function getClinicWorkforcePolicy() {
  return fetchWorkforcePolicy(CLINIC_SATELLITE_KEY);
}

export async function isCpWorkforceHireModeActive(): Promise<boolean> {
  const policy = await getClinicWorkforcePolicy();
  return isCpWorkforceHireMode(policy);
}
