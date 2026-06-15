export type EngineDboError = {
  status: number;
  message: string;
  body?: unknown;
};

export type EngineDboFetchOptions = Omit<RequestInit, "headers"> & {
  customerJwt?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
};

function coreBaseUrl(): string {
  return process.env.ERA_BANK_CORE_URL ?? "http://127.0.0.1:4300";
}

function serviceToken(): string {
  const token = process.env.BANK_CORE_SERVICE_TOKEN;
  if (!token) {
    throw new Error("BANK_CORE_SERVICE_TOKEN is not configured");
  }
  return token;
}

export async function engineDboFetch<T = unknown>(
  path: string,
  options: EngineDboFetchOptions = {},
): Promise<T> {
  const url = `${coreBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${serviceToken()}`,
    ...options.headers,
  };

  if (options.customerJwt) {
    headers["X-Customer-Authorization"] = `Bearer ${options.customerJwt}`;
  }
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const message =
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as { error: unknown }).error === "string"
        ? (parsed as { error: string }).error
        : `Engine request failed (${res.status})`;
    const err: EngineDboError = { status: res.status, message, body: parsed };
    throw err;
  }

  return parsed as T;
}

export async function engineDboJson<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  options: Omit<EngineDboFetchOptions, "method" | "body"> = {},
): Promise<T> {
  return engineDboFetch<T>(path, {
    ...options,
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const dboPaths = {
  authOtpRequest: "/api/v1/dbo/auth/otp/request",
  authOtpVerify: "/api/v1/dbo/auth/otp/verify",
  authAsanChallenge: "/api/v1/dbo/auth/asan/challenge",
  authAsanCallback: "/api/v1/dbo/auth/asan/callback",
  authLogout: "/api/v1/dbo/auth/logout",
  authMe: "/api/v1/dbo/auth/me",
  accounts: "/api/v1/dbo/accounts",
  account: (id: string) => `/api/v1/dbo/accounts/${id}`,
  accountStatement: (id: string) => `/api/v1/dbo/accounts/${id}/statement`,
  transfersInternal: "/api/v1/dbo/transfers/internal",
  paymentOrders: "/api/v1/dbo/payments/orders",
  paymentOrder: (id: string) => `/api/v1/dbo/payments/orders/${id}`,
  paymentOrderSign: (id: string) => `/api/v1/dbo/payments/orders/${id}/sign`,
  paymentOrderSubmit: (id: string) => `/api/v1/dbo/payments/orders/${id}/submit`,
  cards: "/api/v1/dbo/cards",
  card: (id: string) => `/api/v1/dbo/cards/${id}`,
  cardTemporaryBlock: (id: string) => `/api/v1/dbo/cards/${id}/temporary-block`,
} as const;
