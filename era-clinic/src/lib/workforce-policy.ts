import { fetchWorkforcePolicy, isCpWorkforceHireMode } from "@era/satellite-kit";
import { CLINIC_SATELLITE_KEY } from "@/lib/clinic-satellite-key";

export { CLINIC_SATELLITE_KEY };

export async function getClinicWorkforcePolicy() {
  return fetchWorkforcePolicy(CLINIC_SATELLITE_KEY);
}

export async function isCpWorkforceHireModeActive(): Promise<boolean> {
  const policy = await getClinicWorkforcePolicy();
  return isCpWorkforceHireMode(policy);
}
