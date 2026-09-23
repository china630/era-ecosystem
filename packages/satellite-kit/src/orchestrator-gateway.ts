import axios, { AxiosError } from "axios";
import { resolveSatelliteOrganizationId } from "./tenancy/organization-bind-runtime";
import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "./tenancy/resolve-orchestrator-url";

export type OrchestratorGatewayResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

export class SatelliteEventAuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SatelliteEventAuthError";
    this.status = status;
  }
}

export async function publishToOrchestratorGateway(
  event: Record<string, unknown>,
): Promise<OrchestratorGatewayResult> {
  const baseUrl = resolveOrchestratorBaseUrl({
    fallback: "http://127.0.0.1:4000",
  });
  const token = resolveSatelliteEventServiceToken();
  if (!token && process.env.NODE_ENV === "production") {
    const error = "SATELLITE_EVENT_SERVICE_TOKEN is required in production";
    console.error(`[satellite-events] ${error}`);
    throw new SatelliteEventAuthError(error, 401);
  }
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/satellite-events`;
  const eventType =
    typeof event.type === "string" ? event.type : "unknown";

  try {
    const res = await axios.post(url, event, {
      timeout: Number(process.env.ORCHESTRATOR_EVENT_TIMEOUT_MS ?? 15_000),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const ok = res.status >= 200 && res.status < 300;
    if (!ok) {
      console.error(
        `[satellite-events] ${eventType} → ${url} status=${res.status} (token not logged)`,
      );
      if (res.status === 401 || res.status === 403) {
        throw new SatelliteEventAuthError(
          `Orchestrator rejected satellite event (${res.status})`,
          res.status,
        );
      }
    }
    return { ok, status: res.status };
  } catch (err) {
    if (err instanceof SatelliteEventAuthError) throw err;
    const status = err instanceof AxiosError ? err.response?.status : undefined;
    const message =
      err instanceof AxiosError
        ? `${err.message}${status ? ` (${status})` : ""}`
        : err instanceof Error
          ? err.message
          : "Unknown error";
    console.error(
      `[satellite-events] ${eventType} → ${url} failed: ${message}`,
    );
    if (status === 401 || status === 403) {
      throw new SatelliteEventAuthError(
        `Orchestrator rejected satellite event (${status})`,
        status,
      );
    }
    return { ok: false, status, error: message };
  }
}

/**
 * Deployment org UUID for events, SSO SEC-SSO-05, billing.
 * Production: refuses silent `demo-org` — bind via Sync or set env first.
 */
export function satelliteOrganizationId(): string {
  return resolveSatelliteOrganizationId().organizationId;
}
