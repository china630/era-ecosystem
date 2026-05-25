/**
 * CP-VERTICAL-GROWTH Wave A/B/C - thin client for era-365-orchestrator platform add-ons.
 */

type PlatformCallOptions = {
  bearerToken?: string;
  organizationId?: string;
};

function baseUrl(): string {
  return (process.env.CONTROL_PLANE_URL ?? "http://127.0.0.1:4100").replace(/\/$/, "");
}

function bearerToken(explicit?: string): string | undefined {
  const token =
    explicit ??
    process.env.CONTROL_PLANE_SERVICE_TOKEN ??
    process.env.SATELLITE_EVENT_SERVICE_TOKEN;
  return token?.trim() || undefined;
}

async function platformPost<T>(path: string, body: unknown, opts?: PlatformCallOptions): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = bearerToken(opts?.bearerToken);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts?.organizationId) headers["x-organization-id"] = opts.organizationId;

  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }
  }
  if (!res.ok) {
    throw new Error(`Control plane POST ${path} failed: ${res.status}`);
  }
  return json as T;
}

export type SendNotificationInput = {
  templateKey: string;
  channel: "EMAIL" | "WHATSAPP" | "SMS";
  messageClass: "FINANCIAL" | "TRANSACTIONAL" | "LIFECYCLE" | "MARKETING";
  recipient: string;
  sourceEntityType: string;
  sourceEntityId: string;
  payload?: Record<string, unknown>;
  subject?: string;
  body?: string;
};

export function sendNotification(body: SendNotificationInput, opts?: PlatformCallOptions) {
  return platformPost("/platform/notifications/v1/send", body, opts);
}

export function createBookingSlot(body: Record<string, unknown>, opts?: PlatformCallOptions) {
  return platformPost("/platform/booking/v1/slots", body, opts);
}

export function createPortalLink(body: Record<string, unknown>, opts?: PlatformCallOptions) {
  return platformPost("/platform/portal/v1/links", body, opts);
}

export function createPaymentLink(body: Record<string, unknown>, opts?: PlatformCallOptions) {
  return platformPost("/platform/payments/v1/payment-links", body, opts);
}