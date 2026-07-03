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
  signGuestIdentityToken,
  verifyGuestIdentityToken,
  defaultGuestIdentityExpiresAt,
  type GuestIdentityTokenPayload,
} from "./auth/guest-identity-token";
export { fetchVoenPreviewFromRequest } from "./bff/voen-preview-route";
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
  DEFAULT_PUBLIC_PAGE_PREFIXES,
  getBearerOrCookieToken,
  isPublicApiPath,
} from "./auth/middleware-helpers";
export { hashPassword, verifyPassword } from "./auth/password";
export {
  findUserByCredential,
  isSatelliteUserLoginAllowed,
  verifySatelliteUserPassword,
  type SatelliteUserRecord,
} from "./auth/login-user";
export { redirectNoStore } from "./auth/redirect-no-store";
export { assignNoStoreRedirect } from "./auth/assign-no-store-redirect";
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
  resolveOperatingMode,
  parseOperatingMode,
  shouldRouteRevenueToParent,
  shouldFiscalizeOnParent,
  resolveSettlementPolicy,
  parseSettlementPolicy,
  shouldDeferWalkInToHub,
  DEFAULT_OPERATING_MODE,
  DEFAULT_SETTLEMENT_POLICY,
  type OperatingModeSnapshot,
  type OrgOperatingMode,
  type OrgRouting,
  type SettlementHubMode,
  type PendingSettlementNaPolicy,
  type SettlementPolicySnapshot,
} from "./integration/operating-mode";
export {
  fiscalizeForSatellite,
  isFiscalPaymentMethod,
  isFiscalSkipped,
  type SatelliteFiscalizeOutcome,
  type SatelliteFiscalizeSkipped,
} from "./integration/satellite-fiscal";
export {
  mdmHealthCheck,
  lookupGlobalPersonByFin,
  lookupLegalEntityByVoen,
  resolvePersonIdentity,
  mergePersonRecords,
  linkPersonIdentity,
  listPersonIdentifiers,
  getPersonOpsProfile,
  resolveIdentifierForCompliance,
  isValidAzFin,
  type MdmLookupOptions,
  type PersonIdentityInput,
  type MdmClientOptions,
  type PersonIdentifierSummary,
  type PersonOpsProfile,
  type ComplianceIdentityResult,
} from "./integration/mdm-lookup.client";
export {
  resolveGlobalPerson,
  issueGuestQrToken,
  verifyGuestQrToken,
  type GuestIdentityClientOptions,
} from "./integration/guest-identity.client";
export {
  linkWorkforcePersonIdentity,
  fetchWorkforcePersonOpsBatch,
  buildWorkforceDisplayRow,
  type WorkforceDisplayRow,
  type WorkforceResolveResult,
} from "./integration/workforce-person.client";
export {
  buildFinanceBillingUrl,
  buildFinanceTeamUrl,
  financeWebBaseUrl,
} from "./integration/finance-deep-links";
export {
  financeStockCheck,
  financeReplenishmentSuggestions,
  financeRateQuote,
  financeCodClearing,
  financeSupplierMatch,
  financeExternalPurchase,
  financeEligibilityCheck,
  financeFxPreview,
  financeHsTariffPreview,
  financeVoenLookup,
  type FinanceHandoffOptions,
  type FinanceRateQuoteResult,
  type FinanceCodClearingResult,
  type FinanceExternalPurchaseResult,
  type FinanceFxPreviewResult,
  type FinanceHsPreviewResult,
  type FinanceVoenLookupResult,
} from "./integration/finance-handoffs.client";
export {
  getHsMeta,
  getHsTariff,
  getCompanyByVoen,
  getBanks,
  validateIban,
  getUom,
  getTaxRates,
  getGeoCountries,
  getGeoCities,
  getChartOfAccounts,
  type ReferenceCatalogClientOptions,
} from "./integration/reference-catalog.client";
export {
  getFxRate,
  getFxRates,
  getFxRatesRange,
  convertFx,
  type FxRateClientOptions,
} from "./integration/fx-rate.client";
export {
  platformCatalogGet,
  platformFxConvert,
  platformVoenLookup,
  type PlatformCatalogClientOptions,
} from "./integration/platform-catalog.client";
export {
  fetchWorkforcePolicy,
  isCpWorkforceHireMode,
  type WorkforcePolicyResult,
  type WorkforceHireMode,
  type WorkforcePolicyClientOptions,
} from "./integration/workforce-policy.client";
export type { CalendarDayType, CalendarDayPoint } from "@era/contracts";
export {
  getCalendarDay,
  isWorkingDay as isCalendarWorkingDay,
  addBusinessDays as addCalendarBusinessDays,
  getCalendarDaysRange,
  warmCalendarYear,
  fallbackIsWorkingDay,
  fallbackDayType,
  type CalendarClientOptions,
} from "./integration/calendar.client";
export {
  assertIndustryModuleActive,
  assertHotelModuleActive,
  assertHotelModuleForRoute,
  isIndustryModuleActive,
  IndustryModuleInactiveError,
  INDUSTRY_MODULE_BY_APP,
  HOTEL_MODULE_BY_ROUTE,
  HOTEL_MODULE_KEY_ALIASES,
  HOTEL_PRICING_MODULE_KEYS,
  consolidateHotelModuleKeys,
  isHotelModuleActive,
  resolveHotelModuleForPathname,
  resolveHotelModuleKey,
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
export {
  SANATORIUM_SYSTEM_KEYS,
  WORKSPACE_SYSTEMS,
  type WorkspaceSystemKey,
  type WorkspaceSystemMeta,
} from "./platform/workspace-system-catalog";
export {
  auditMutation,
  auditIntegrityHash,
  buildAuditChangesJson,
  recordSatelliteAudit,
  redactAuditChanges,
  stampWorkforceAuditContext,
  type WorkforceAuditContext,
  type MutationAuditContext,
  type SatelliteAuditInput,
  type SatelliteAuditWriter,
} from "./audit/satellite-audit";
