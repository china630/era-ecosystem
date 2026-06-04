import type { ResolvedSatelliteEndpoint } from "./satellite-endpoint-registry.service";

export async function forwardToClinic(
  endpoint: ResolvedSatelliteEndpoint,
  event: Record<string, unknown>,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (endpoint.secret) {
    headers["x-clinic-bridge-secret"] = endpoint.secret;
  }

  const res = await fetch(
    `${endpoint.baseUrl}/api/integration/hotel-lifecycle`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(
        Number(process.env.SATELLITE_FANOUT_TIMEOUT_MS ?? 15_000),
      ),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Clinic bridge failed: ${res.status} ${text.slice(0, 200)}`,
    );
  }
}
