import {
  authCookieName,
  fetchSubscriptionSnapshot,
  getBearerOrCookieToken,
  hasActiveModule,
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

export async function assertBankingEntitlement(
  moduleKey = "industry_banking",
): Promise<void> {
  if (!BANK_ORG_ID) {
    if (process.env.NODE_ENV !== "production") return;
    throw new BankingEntitlementError(moduleKey);
  }
  const snapshot = await fetchSubscriptionSnapshot(BANK_ORG_ID);
  if (!snapshot) {
    if (process.env.NODE_ENV !== "production") return;
    throw new BankingEntitlementError(moduleKey);
  }
  if (!hasActiveModule(snapshot, moduleKey)) {
    throw new BankingEntitlementError(moduleKey);
  }
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
  if (SERVICE_TOKEN) {
    reqHeaders["X-Service-Token"] = SERVICE_TOKEN;
  }
  if (userJwt) {
    reqHeaders.Authorization = `Bearer ${userJwt}`;
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
