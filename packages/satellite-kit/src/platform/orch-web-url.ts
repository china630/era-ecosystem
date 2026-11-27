import { getRuntimeConfigMemory } from "../tenancy/runtime-config-memory";

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const v = process.env[name]?.trim();
  return v || undefined;
}

function trimSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Browser app origin for register / pricing / help (not the API / event URL).
 * Prefer Sync `orchestratorPublicBaseUrl`; install env is bootstrap only.
 * Never falls back to localhost in production.
 */
export function resolveOrchestratorPublicBaseUrl(): string {
  const fromMem = getRuntimeConfigMemory().orchestratorPublicBaseUrl?.trim();
  if (fromMem) return trimSlash(fromMem);

  const fromEnv =
    readEnv("ERA_APP_ORIGIN") ??
    readEnv("NEXT_PUBLIC_ORCH_WEB_URL") ??
    readEnv("NEXT_PUBLIC_ERA_APP_ORIGIN");
  if (fromEnv) return trimSlash(fromEnv);

  if (readEnv("NODE_ENV") === "production" || readEnv("ERA_IN_DOCKER") === "1") {
    return "";
  }
  return "http://127.0.0.1:3000";
}

/** @deprecated Prefer resolveOrchestratorPublicBaseUrl — same resolver. */
export function orchWebUrl(): string {
  return resolveOrchestratorPublicBaseUrl();
}

export function orchPublicHref(path: string): string {
  const base = resolveOrchestratorPublicBaseUrl();
  if (!base) return "";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
