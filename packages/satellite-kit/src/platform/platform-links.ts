import { kitJson, kitResultToNext, type KitHttpResult } from "../tenancy/organization-bind";
import { orchPublicHref, resolveOrchestratorPublicBaseUrl } from "./orch-web-url";

export type PlatformLinksBody = {
  appOrigin: string | null;
  registerUrl: string | null;
  registerOrgUrl: string | null;
  pricingUrl: string | null;
  helpUrl: string | null;
  termsUrl: string | null;
};

/** Build public cabinet links from Sync/bootstrap app origin (no auth). */
export function buildPlatformLinks(): PlatformLinksBody {
  const appOrigin = resolveOrchestratorPublicBaseUrl() || null;
  if (!appOrigin) {
    return {
      appOrigin: null,
      registerUrl: null,
      registerOrgUrl: null,
      pricingUrl: null,
      helpUrl: null,
      termsUrl: null,
    };
  }
  return {
    appOrigin,
    registerUrl: orchPublicHref("/register") || null,
    registerOrgUrl: orchPublicHref("/register-org") || null,
    pricingUrl: orchPublicHref("/pricing") || null,
    helpUrl: orchPublicHref("/help") || null,
    termsUrl: orchPublicHref("/terms") || null,
  };
}

/** Nest / Next kit handler: GET /api/public/platform-links */
export function readPlatformLinks(): KitHttpResult {
  const body = buildPlatformLinks();
  if (!body.appOrigin) {
    return kitJson(body, 503);
  }
  return kitJson(body, 200);
}

/** App Router / Express-Web Request adapter. */
export async function platformLinksGet(_request?: Request): Promise<Response> {
  return kitResultToNext(readPlatformLinks());
}
