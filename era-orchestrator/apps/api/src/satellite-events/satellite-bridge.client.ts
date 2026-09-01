import type { ResolvedSatelliteEndpoint } from "./satellite-endpoint-registry.service";

export type SatelliteBridgeResponse = {
  satelliteUserId?: string;
  ok?: boolean;
};

export async function forwardToSatellite(
  endpoint: ResolvedSatelliteEndpoint,
  path: string,
  event: Record<string, unknown>,
  secretHeader = "x-satellite-bridge-secret",
): Promise<SatelliteBridgeResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (endpoint.secret) {
    headers[secretHeader] = endpoint.secret;
  }

  const res = await fetch(`${endpoint.baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(
      Number(process.env.SATELLITE_FANOUT_TIMEOUT_MS ?? 15_000),
    ),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const loginTaken = res.status === 409 && text.includes("LOGIN_TAKEN");
    if (loginTaken) {
      throw new Error(`Satellite bridge LOGIN_TAKEN: ${text.slice(0, 200)}`);
    }
    throw new Error(
      `Satellite bridge failed: ${res.status} ${text.slice(0, 200)}`,
    );
  }

  const body = (await res.json().catch(() => ({}))) as SatelliteBridgeResponse;
  return body;
}
