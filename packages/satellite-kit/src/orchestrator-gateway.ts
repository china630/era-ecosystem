import axios, { AxiosError } from "axios";
import { resolveSatelliteOrganizationId } from "./tenancy/organization-bind-core";

export type OrchestratorGatewayResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

export async function publishToOrchestratorGateway(
  event: Record<string, unknown>,
): Promise<OrchestratorGatewayResult> {
  const baseUrl =
    process.env.ORCHESTRATOR_EVENT_URL ??
    process.env.ORCHESTRATOR_URL ??
    "http://localhost:4100";
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? "";
  if (!token && process.env.NODE_ENV === "production") {
    return {
      ok: false,
      error: "SATELLITE_EVENT_SERVICE_TOKEN is required in production",
    };
  }
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/satellite-events`;

  try {
    const res = await axios.post(url, event, {
      timeout: Number(process.env.ORCHESTRATOR_EVENT_TIMEOUT_MS ?? 15_000),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (err) {
    const message =
      err instanceof AxiosError
        ? `${err.message}${err.response ? ` (${err.response.status})` : ""}`
        : err instanceof Error
          ? err.message
          : "Unknown error";
    return { ok: false, error: message };
  }
}

export function satelliteOrganizationId(): string {
  return resolveSatelliteOrganizationId().organizationId;
}
