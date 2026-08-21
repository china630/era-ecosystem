/**
 * Jest stand-in for @era/satellite-kit — avoids loading jose ESM via the kit barrel.
 * Keeps real assertEnvServiceToken for auth-negative proofs.
 */
const {
  assertEnvServiceToken,
  assertBridgeSecret,
} = require("../../../../../packages/satellite-kit/dist/auth/assert-service-token.js");

module.exports = {
  assertEnvServiceToken,
  assertBridgeSecret,
  resolveOrchestratorBaseUrl: () =>
    process.env.CONTROL_PLANE_URL || process.env.ORCHESTRATOR_URL || "",
  resolveSatelliteEventServiceToken: () =>
    process.env.SATELLITE_EVENT_SERVICE_TOKEN || "",
  applyOrganizationBind: jest.fn(async () => undefined),
  applySatelliteRuntimeConfig: jest.fn(async ({ config }) => config ?? {}),
  hydrateRuntimeConfigFromDb: jest.fn(async () => undefined),
  hydrateOrganizationBindFromDb: jest.fn(async () => undefined),
  onSatelliteBoot: jest.fn(async () => undefined),
  publicRuntimeConfigView: (cfg) => cfg ?? {},
  satelliteRuntimeConfig: () => ({}),
  resolveSatelliteOrganizationId: () => ({
    organizationId: "org-test",
    source: "fallback",
  }),
  satelliteOrganizationId: () => "org-test",
  createSatelliteTenantExtension: () => ({}),
  publishToOrchestratorGateway: jest.fn(),
  platformNotificationsEnabled: () => false,
  trySendPlatformNotification: jest.fn(),
  shouldRouteRevenueToParent: () => false,
  shouldFiscalizeOnParent: () => false,
};
