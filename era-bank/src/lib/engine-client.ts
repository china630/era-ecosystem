import {
  authCookieName,
  fetchSubscriptionSnapshot,
  getBearerOrCookieToken,
  hasActiveModule,
  parseActiveModules,
} from "@era/satellite-kit";
import { cookies, headers } from "next/headers";

const ENGINE_BASE =
  process.env.ERA_BANK_CORE_URL?.replace(/\/$/, "") ?? "http://localhost:4300";
const SERVICE_TOKEN = process.env.BANK_CORE_SERVICE_TOKEN ?? "";
const BANK_ORG_ID =
  process.env.ERA_BANK_ORGANIZATION_ID ??
  process.env.ERA_SATELLITE_ORGANIZATION_ID ??
  "";

export class BankEngineError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Bank core request failed (${status})`);
    this.name = "BankEngineError";
    this.status = status;
    this.body = body;
  }
}

export class BankingEntitlementError extends Error {
  readonly status = 403;
  readonly moduleKey: string;

  constructor(moduleKey: string) {
    super(`Banking module not active: ${moduleKey}`);
    this.name = "BankingEntitlementError";
    this.moduleKey = moduleKey;
  }
}

export async function loadBankSubscriptionSnapshot(): Promise<Record<string, unknown> | null> {
  const base = (
    process.env.CONTROL_PLANE_URL ??
    process.env.ORCHESTRATOR_EVENT_URL ??
    ""
  ).replace(/\/$/, "");
  const token =
    process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    "";

  // Prefer internal snapshot (service token). /v1/subscription/me is JWT-only.
  if (base && BANK_ORG_ID) {
    try {
      const res = await fetch(
        `${base}/internal/v1/subscription/snapshot?organizationId=${encodeURIComponent(BANK_ORG_ID)}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
                "x-service-token": token,
              }
            : {},
        },
      );
      if (res.ok) {
        return (await res.json()) as Record<string, unknown>;
      }
    } catch {
      /* fall through */
    }
  }

  if (!BANK_ORG_ID) return null;
  return fetchSubscriptionSnapshot(BANK_ORG_ID);
}

export async function assertBankingEntitlement(
  moduleKey = "industry_banking",
): Promise<void> {
  if (!BANK_ORG_ID) {
    if (process.env.NODE_ENV !== "production") return;
    throw new BankingEntitlementError(moduleKey);
  }
  const snapshot = await loadBankSubscriptionSnapshot();
  const strict = process.env.ERA_BANK_ENTITLEMENTS_STRICT === "true";
  if (!snapshot) {
    if (process.env.NODE_ENV !== "production") return;
    // Fail-open when CP is unreachable so local docker ops UI stays usable.
    if (strict) throw new BankingEntitlementError(moduleKey);
    return;
  }
  // Demo slug orgs (e.g. demo-bank-org-001) are not UUIDs — orch returns an
  // empty snapshot. Do not block ops lists unless strict mode is on.
  if (parseActiveModules(snapshot).size === 0) {
    if (process.env.NODE_ENV !== "production" || !strict) return;
    throw new BankingEntitlementError(moduleKey);
  }
  if (hasActiveModule(snapshot, moduleKey)) return;

  // Demo/docker often seeds only the satellite gate SKU. L2 banking_* modules
  // are then covered by industry_banking until commercial SKUs are split.
  if (
    moduleKey.startsWith("banking_") &&
    hasActiveModule(snapshot, "industry_banking")
  ) {
    return;
  }

  throw new BankingEntitlementError(moduleKey);
}

async function resolveUserJwt(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  return (
    getBearerOrCookieToken(cookieStore, headerStore, authCookieName()) ??
    undefined
  );
}

export type ForwardToBankCoreInput = {
  method: string;
  /** Engine path starting with /api/v1/… */
  path: string;
  body?: string | null;
  userJwt?: string;
  /** Ops staff id for maker-checker when calling via service token */
  opsUserId?: string;
  idempotencyKey?: string;
  searchParams?: URLSearchParams;
  entitlementModule?: string;
};

/** Thin BFF helper — forwards to era-bank-core; never persists balances locally. */
export async function forwardToBankCore(
  input: ForwardToBankCoreInput,
): Promise<Response> {
  if (input.entitlementModule) {
    await assertBankingEntitlement(input.entitlementModule);
  } else {
    await assertBankingEntitlement("industry_banking");
  }

  const userJwt = input.userJwt ?? (await resolveUserJwt());
  const url = new URL(
    `${ENGINE_BASE}${input.path.startsWith("/") ? input.path : `/${input.path}`}`,
  );
  if (input.searchParams) {
    input.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }

  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    "X-Organization-Id": BANK_ORG_ID,
  };
  // Prefer service-token auth for BFF→core. Satellite session JWT must NOT be
  // sent as Authorization — BankAuthGuard reads Bearer first and rejects it.
  if (SERVICE_TOKEN) {
    reqHeaders["X-Service-Token"] = SERVICE_TOKEN;
    reqHeaders.Authorization = `Bearer ${SERVICE_TOKEN}`;
  } else if (userJwt) {
    reqHeaders.Authorization = `Bearer ${userJwt}`;
  }
  if (input.opsUserId) {
    reqHeaders["X-Ops-User-Id"] = input.opsUserId;
  }
  if (input.idempotencyKey) {
    reqHeaders["Idempotency-Key"] = input.idempotencyKey;
  }
  if (input.body != null && input.method !== "GET" && input.method !== "HEAD") {
    reqHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(url.toString(), {
    method: input.method,
    headers: reqHeaders,
    body:
      input.method === "GET" || input.method === "HEAD"
        ? undefined
        : (input.body ?? undefined),
    cache: "no-store",
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function enginePath(
  prefix: string,
  segments: string[] | undefined,
  search = "",
): string {
  const tail = segments?.length ? `/${segments.join("/")}` : "";
  return `/api/v1/${prefix}${tail}${search}`;
}
