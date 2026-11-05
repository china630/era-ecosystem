import { requestOrganizationId } from "@/lib/request-organization";

function orchBase(): string {
  return (
    process.env.ORCHESTRATOR_URL?.trim() ||
    process.env.CONTROL_PLANE_URL?.trim() ||
    process.env.ORCHESTRATOR_EVENT_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
}

function serviceToken(): string {
  return (
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
    ""
  );
}

export type CpChannelRow = {
  id: string;
  fromOrgId: string;
  fromSatelliteKey: string;
  toOrgId: string;
  toSatelliteKey: string;
  kind: string;
  enabled: boolean;
  managedBy: string;
  fromOrgName?: string | null;
  toOrgName?: string | null;
};

export async function fetchCpChannels(): Promise<{
  outbound: CpChannelRow[];
  inbound: CpChannelRow[];
  organizationId: string;
}> {
  const organizationId = requestOrganizationId();
  const base = orchBase();
  const token = serviceToken();
  if (!base || !token) {
    return { outbound: [], inbound: [], organizationId };
  }
  const res = await fetch(`${base}/v1/internal/channels`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-service-token": token,
      "X-Organization-Id": organizationId,
    },
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return { outbound: [], inbound: [], organizationId };
  const body = (await res.json()) as {
    outbound?: CpChannelRow[];
    inbound?: CpChannelRow[];
  };
  return {
    outbound: body.outbound ?? [],
    inbound: body.inbound ?? [],
    organizationId,
  };
}

export async function patchCpChannel(
  channelId: string,
  enabled: boolean,
): Promise<{ ok: boolean; status: number }> {
  const organizationId = requestOrganizationId();
  const base = orchBase();
  const token = serviceToken();
  if (!base || !token) return { ok: false, status: 503 };
  const res = await fetch(`${base}/v1/internal/channels/${channelId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-service-token": token,
      "X-Organization-Id": organizationId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled }),
  }).catch(() => null);
  return { ok: Boolean(res?.ok), status: res?.status ?? 503 };
}
