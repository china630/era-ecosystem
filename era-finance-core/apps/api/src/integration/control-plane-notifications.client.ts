/** CP-VERTICAL-GROWTH — Finance to control plane Notifications Pack (ERA_NOTIFICATIONS_PACK). */

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

function controlPlaneBaseUrl(): string {
  return (process.env.CONTROL_PLANE_URL ?? "http://127.0.0.1:4100").replace(/\/$/, "");
}

function serviceBearerToken(): string | undefined {
  const token = process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim();
  return token || undefined;
}

export async function sendControlPlaneNotification(
  organizationId: string,
  body: SendNotificationInput,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-organization-id": organizationId,
  };
  const token = serviceBearerToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${controlPlaneBaseUrl()}/platform/notifications/v1/send`, {
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
    throw new Error(`Control plane notification send failed: ${res.status}`);
  }
  return json;
}

export function notificationsPackEnabled(): boolean {
  return (process.env.ERA_NOTIFICATIONS_PACK ?? "").toLowerCase() === "true";
}
