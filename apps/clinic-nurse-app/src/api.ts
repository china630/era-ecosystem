import type { BoardSnapshot, Proc } from "./types";

export const CLINIC_URL = (
  process.env.EXPO_PUBLIC_CLINIC_URL ?? "https://clinic.era-365.online"
).replace(/\/$/, "");

const DEFAULT_TIMEOUT_MS = 10_000;

export function cookieHeader(token: string): string {
  return `era_session=${token}`;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return body;
}

function withTimeout(ms: number = DEFAULT_TIMEOUT_MS): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

/** True when the clinic origin is the shared (non-org-subdomain) host. */
export function shouldAlwaysAskOrgNo(): boolean {
  try {
    const host = new URL(CLINIC_URL).hostname.toLowerCase();
    return host === "clinic.era-365.online";
  } catch {
    return true;
  }
}

export async function loginMeta(): Promise<{ hostBound: boolean }> {
  const res = await fetch(`${CLINIC_URL}/api/auth/login`, {
    method: "GET",
    signal: withTimeout(),
  });
  const body = await readJson(res);
  const data = (body.data ?? body) as { hostBound?: boolean };
  return { hostBound: data.hostBound === true };
}

export async function login(input: {
  login: string;
  password: string;
  orgNo?: string;
}): Promise<{ token: string; fullName: string; login: string }> {
  const res = await fetch(`${CLINIC_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      login: input.login.trim(),
      password: input.password,
      ...(input.orgNo?.trim() ? { orgNo: input.orgNo.trim() } : {}),
    }),
    signal: withTimeout(),
  });
  const body = await readJson(res);
  const data = (body.data ?? body) as {
    token?: string;
    error?: string;
    user?: { fullName?: string; login?: string };
  };
  if (!res.ok || !data.token) {
    throw new Error(data.error || "login failed");
  }
  return {
    token: data.token,
    fullName: data.user?.fullName || data.user?.login || input.login.trim(),
    login: (data.user?.login || input.login).trim(),
  };
}

export type MeResult =
  | { kind: "ok"; fullName: string; login: string }
  | { kind: "unauthorized" }
  | { kind: "unreachable" };

export async function fetchMe(token: string): Promise<MeResult> {
  try {
    const res = await fetch(`${CLINIC_URL}/api/auth/me`, {
      headers: { Accept: "application/json", Cookie: cookieHeader(token) },
      signal: withTimeout(),
    });
    if (res.status === 401) return { kind: "unauthorized" };
    if (!res.ok) return { kind: "unreachable" };
    const body = await readJson(res);
    const data = (body.data ?? body) as { fullName?: string; login?: string };
    return {
      kind: "ok",
      fullName: data.fullName || data.login || "",
      login: (data.login || "").trim(),
    };
  } catch {
    return { kind: "unreachable" };
  }
}

export async function logout(token: string): Promise<void> {
  await fetch(`${CLINIC_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookieHeader(token) },
    signal: withTimeout(5_000),
  }).catch(() => undefined);
}

export async function fetchBoard(
  token: string,
  date: string,
  locale: string,
): Promise<{ status: number; snapshot?: BoardSnapshot }> {
  let res: Response;
  try {
    res = await fetch(
      `${CLINIC_URL}/api/procedures?date=${encodeURIComponent(date)}&locale=${encodeURIComponent(locale)}&status=ALL&mine=1`,
      {
        headers: { Accept: "application/json", Cookie: cookieHeader(token) },
        signal: withTimeout(),
      },
    );
  } catch {
    return { status: 0 };
  }
  if (res.status === 401) return { status: 401 };
  if (!res.ok) return { status: res.status };
  const body = await readJson(res);
  const data = (body.data ?? body) as {
    orders?: Proc[];
    mineUnlinked?: boolean;
    dayEndHour?: number;
  };
  const orders = Array.isArray(data) ? (data as Proc[]) : (data.orders ?? []);
  return {
    status: 200,
    snapshot: {
      date,
      orders,
      mineUnlinked: !Array.isArray(data) && data.mineUnlinked === true,
      dayEndHour: typeof data.dayEndHour === "number" ? data.dayEndHour : 18,
      syncedAt: new Date().toISOString(),
    },
  };
}

export type CheckInBusyDetails = {
  resourceId?: string;
  resourceName?: string | null;
  blockingOrderId?: string;
  blockingGuestName?: string | null;
  blockingActualEndsAt?: string | null;
};

export async function postCheckIn(
  token: string,
  procedureId: string,
): Promise<{
  status: number;
  code?: string;
  error?: string;
  details?: CheckInBusyDetails;
}> {
  try {
    const res = await fetch(`${CLINIC_URL}/api/procedures/${encodeURIComponent(procedureId)}/check-in`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Cookie: cookieHeader(token),
      },
      body: JSON.stringify({}),
      signal: withTimeout(),
    });
    const body = await readJson(res);
    let data = (body.data ?? body) as {
      code?: string;
      error?: string;
      details?: CheckInBusyDetails;
      message?: unknown;
    };
    // Nest may nest the thrown object under `message`.
    if (data.message && typeof data.message === "object" && !Array.isArray(data.message)) {
      const nested = data.message as {
        code?: string;
        error?: string;
        details?: CheckInBusyDetails;
      };
      data = {
        code: nested.code ?? data.code,
        error:
          typeof nested.error === "string"
            ? nested.error
            : typeof data.error === "string"
              ? data.error
              : undefined,
        details: nested.details ?? data.details,
      };
    }
    return {
      status: res.status,
      code: data.code,
      error: typeof data.error === "string" ? data.error : undefined,
      details: data.details,
    };
  } catch {
    return { status: 0 };
  }
}
