export {
  publishToOrchestratorGateway,
  satelliteOrganizationId,
  type OrchestratorGatewayResult,
} from "./orchestrator-gateway";

export {
  buildSsoPayload,
  verifySsoSignature,
} from "./auth/sso-verify";
export {
  authCookieName,
  signSatelliteSession,
  verifySatelliteSession,
  type SatelliteSessionPayload,
} from "./auth/session";
export {
  ssoExchangeBodySchema,
  type SsoExchangeBody,
} from "./auth/sso-exchange-schema";
export {
  DEFAULT_PUBLIC_API_PREFIXES,
  getBearerOrCookieToken,
  isPublicApiPath,
} from "./auth/middleware-helpers";
export {
  FINANCE_OWNER_ROLES,
  SATELLITE_ROLE,
  isBusinessOwnerRole,
  mapFinanceRoleToSatellite,
  sessionHasRole,
  type SatelliteRoleCode,
} from "./auth/roles";
export {
  SatelliteForbiddenError,
  forbidUnlessRole,
  requireRole,
} from "./auth/require-role";
