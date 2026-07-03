import { satelliteOrganizationId } from "@era/satellite-kit";

export async function postHotelSettlementPending(input: {
  sourceRef: string;
  amount: number;
  description: string;
  payerLabel?: string;
  globalPersonId?: string;
  idempotencyKey: string;
}) {
  const base = (process.env.HOTEL_PMS_URL ?? "http://127.0.0.1:3201").replace(/\/$/, "");
  const secret = process.env.POS_BRIDGE_SECRET ?? process.env.CLINIC_BRIDGE_SECRET;
  if (!secret) throw new Error("POS_BRIDGE_SECRET not configured");
  const orgId = satelliteOrganizationId();
  if (!orgId) throw new Error("ERA_SATELLITE_ORGANIZATION_ID not configured");

  const res = await fetch(`${base}/api/settlement/pending`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pos-bridge-secret": secret,
      Authorization: `Bearer ${secret}`,
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      sourceSystem: "CLINIC",
      sourceOrgId: orgId,
      sourceRef: input.sourceRef,
      amount: input.amount,
      description: input.description,
      payerLabel: input.payerLabel,
      globalPersonId: input.globalPersonId,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hotel pending charge failed: ${res.status} ${text}`);
  }
  const payload = await res.json();
  return payload.data ?? payload;
}
