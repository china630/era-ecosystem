import { WORKSPACE_SATELLITE_KEY } from "@era/satellite-kit/platform/workspace-system-catalog";

/** Preset satellite keys for HR employee provisioning (finance → orchestrator bus). */
export const PROVISIONED_SATELLITE_OPTIONS = [
  { value: "", labelKey: "employees.provisionedSatelliteNone" },
  { value: WORKSPACE_SATELLITE_KEY.HOTEL_PMS, labelKey: "employees.provisionedSatelliteHotel" },
  { value: WORKSPACE_SATELLITE_KEY.FNB_POS, labelKey: "employees.provisionedSatelliteFnb" },
  { value: WORKSPACE_SATELLITE_KEY.CLINIC, labelKey: "employees.provisionedSatelliteClinic" },
] as const;

/** Mirrors `SATELLITE_OPERATIONAL_ROLES` in API `satellite-role-map.ts`. */
export const PROVISIONED_SATELLITE_ROLES = [
  "WAITER",
  "MANAGER",
  "RECEPTION",
  "HOUSEKEEPING",
  "CHEF",
  "CASHIER",
  "STAFF",
] as const;
