export async function postHotelElektrawebOutbox(input: {
  hotelOrganizationId: string;
  idempotencyKey: string;
  patientOrigin: "IN_HOUSE" | "WALK_IN";
  reservationId?: string | null;
  procedureCode: string;
  procedureName: string;
  amount: number;
  description: string;
}): Promise<{ id: string; status: string }> {
  const base = (
    process.env.HOTEL_PMS_URL?.trim() ||
    process.env.ERA_HOTEL_PMS_ORIGIN?.trim() ||
    "http://127.0.0.1:3201"
  ).replace(/\/$/, "");
  // Pool URL is one host for all hotels (SatelliteEndpoint baseUrl of hotel org / env fallback).
  const secret = process.env.POS_BRIDGE_SECRET ?? process.env.CLINIC_BRIDGE_SECRET;
  if (!secret) throw new Error("POS_BRIDGE_SECRET not configured");
  if (!input.hotelOrganizationId) {
    throw new Error("hotelOrganizationId required for Elektraweb outbox enqueue");
  }
  const res = await fetch(`${base}/api/integrations/elektraweb-bridge/outbox`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pos-bridge-secret": secret,
    },
    body: JSON.stringify({
      organizationId: input.hotelOrganizationId,
      source: "CLINIC",
      idempotencyKey: input.idempotencyKey,
      patientOrigin: input.patientOrigin,
      reservationId: input.reservationId ?? undefined,
      procedureCode: input.procedureCode,
      procedureName: input.procedureName,
      amount: input.amount,
      description: input.description,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json: { id?: string; status?: string; error?: string } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    json = { error: text };
  }
  if (!res.ok) {
    throw new Error(json.error || `Hotel outbox failed: ${res.status} ${text}`);
  }
  return { id: String(json.id ?? ""), status: String(json.status ?? "PENDING") };
}
