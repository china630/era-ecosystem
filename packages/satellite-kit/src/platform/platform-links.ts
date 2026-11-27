import { kitJson, kitResultToNext, type KitHttpResult } from "../tenancy/organization-bind";
import { getRuntimeConfigMemory } from "../tenancy/runtime-config-memory";
import { resolveOrchestratorPublicBaseUrl } from "./orch-web-url";
import type { PlatformLinksBody } from "../ui/use-platform-links";

export type { PlatformLinksBody };

function resolveAppOrigin(): string {
  const fromMem = getRuntimeConfigMemory().orchestratorPublicBaseUrl?.trim();
  if (fromMem) return fromMem.replace(/\/$/, "");
  return resolveOrchestratorPublicBaseUrl();
}

/** Build public cabinet links from Sync/bootstrap app origin (no auth). */
export function buildPlatformLinks(): PlatformLinksBody {
  const appOrigin = resolveAppOrigin() || null;
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
  const href = (path: string) => `${appOrigin}${path.startsWith("/") ? path : `/${path}`}`;
  return {
    appOrigin,
    registerUrl: href("/register"),
    registerOrgUrl: href("/register-org"),
    pricingUrl: href("/pricing"),
    helpUrl: href("/help"),
    termsUrl: href("/terms"),
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
