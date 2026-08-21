/** Jest stub — kit barrel pulls jose ESM under CJS Jest. */
export function satelliteOrganizationId(): string {
  return process.env.ERA_SATELLITE_ORGANIZATION_ID || "test-org";
}
