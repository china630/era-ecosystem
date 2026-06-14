import type { ResolvedSatelliteEndpoint } from "./satellite-endpoint-registry.service";

export async function forwardToSatellite(
  endpoint: ResolvedSatelliteEndpoint,
  path: string,
  event: Record<string, unknown>,
  secretHeader = "x-satellite-bridge-secret",
): Promise<void> {
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
    throw new Error(
      `Satellite bridge failed: ${res.status} ${text.slice(0, 200)}`,
    );
  }
}
