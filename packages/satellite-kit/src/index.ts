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
  signSatelliteSsoPayload,
  buildSatelliteSsoLaunchUrl,
  defaultSsoExpiresAt,
  type SatelliteSsoLaunchParams,
} from "./auth/sso-launch";
export {
  executeSatelliteSsoExchange,
  type SsoExchangePrisma,
  type SsoExchangeResult,
} from "./auth/sso-exchange";
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
  FINANCE_CROSS_SYSTEM_ROLES,
  SATELLITE_ROLE,
  isBusinessOwnerRole,
  mapFinanceRoleToSatellite,
  sessionHasRole,
  type SatelliteRoleCode,
} from "./auth/roles";
export {
  resolvePlatformCapabilities,
  hasPlatformCapability,
  isLocalOperationalSession,
  type PlatformCapabilities,
} from "./auth/platform-session";
export {
  SatelliteForbiddenError,
  forbidUnlessRole,
  requireRole,
} from "./auth/require-role";

export {
  sendNotification,
  createBookingSlot,
  createBookingSlots,
  createBookingAppointment,
  createPortalLink,
  createPaymentLink,
  createPromotion,
  createCustomDomain,
  createShipment,
  getSubscriptionMe,
  type SendNotificationInput,
  type PlatformCallOptions,
} from "./integration/control-plane-platform.client";
export {
  platformNotificationsEnabled,
  trySendPlatformNotification,
} from "./integration/platform-notify";
export {
  fetchSubscriptionSnapshot,
  hasActiveModule,
  moduleEnabled,
  parseActiveModules,
  type PlatformModuleKey,
} from "./integration/platform-hook-policy";
export {
  runPlatformCommerceHooks,
  type PlatformCommerceHooksInput,
} from "./integration/platform-commerce-hooks";
export {
  mdmHealthCheck,
  lookupGlobalPersonByFin,
  lookupLegalEntityByVoen,
  type MdmLookupOptions,
} from "./integration/mdm-lookup.client";
export {
  buildFinanceBillingUrl,
  buildFinanceTeamUrl,
  financeWebBaseUrl,
} from "./integration/finance-deep-links";
export {
  assertIndustryModuleActive,
  isIndustryModuleActive,
  IndustryModuleInactiveError,
  INDUSTRY_MODULE_BY_APP,
  type IndustryAppKey,
} from "./integration/org-entitlement-gate";
export {
  INDUSTRY_NAV_ITEMS,
  INDUSTRY_MODULE_SLUGS,
  FINANCE_TILE,
  financeWebUrl,
  hasIndustryModuleAccess,
  industryItemByVertical,
  satelliteUrlForItem,
  type IndustryModuleKey,
  type IndustryModuleSlug,
  type SubscriptionModulesSnapshot,
} from "./platform/industry-modules";
