import { getClinicHotelOrganizationId } from "@/domain/physio/clinic-cutover.service";
import { requestOrganizationId } from "@/lib/request-organization";

export async function postHotelSettlementPending(input: {
  sourceRef: string;
  amount: number;
  description: string;
  payerLabel?: string;
  globalPersonId?: string;
  idempotencyKey: string;
  sku?: string;
  qty?: number;
  /** Hotel BOCC / NAS revenue code — required for non-zero amount (hub refuses blank). */
  revenueCode: string;
  basketRef?: string;
}) {
  const secret = process.env.POS_BRIDGE_SECRET ?? process.env.CLINIC_BRIDGE_SECRET;
  if (!secret) throw new Error("POS_BRIDGE_SECRET not configured");
  const revenueCode = input.revenueCode.trim();
  if (input.amount !== 0 && !revenueCode) {
    throw new Error("revenueCode is required for a pending charge with amount");
  }
  const orgId = requestOrganizationId();
  const hotelOrganizationId = (await getClinicHotelOrganizationId()) ?? undefined;
  if (!hotelOrganizationId) {
    throw new Error("hotelOrganizationId required for hotel pending charge");
  }
  const { PEER_SATELLITE_HOTEL, resolvePeerSatelliteBaseUrl } = await import(
    "@era/satellite-kit"
  );
  const base = (
    await resolvePeerSatelliteBaseUrl({
      organizationId: hotelOrganizationId,
      satelliteKey: PEER_SATELLITE_HOTEL,
    })
  ).baseUrl;

  const res = await fetch(`${base}/api/settlement/pending`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pos-bridge-secret": secret,
      Authorization: `Bearer ${secret}`,
      "x-era-organization-id": hotelOrganizationId,
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      sourceSystem: "CLINIC",
      sourceOrgId: orgId,
      hotelOrganizationId,
      sourceRef: input.sourceRef,
      amount: input.amount,
      description: input.description,
      payerLabel: input.payerLabel,
      globalPersonId: input.globalPersonId,
      ...(input.sku?.trim() ? { sku: input.sku.trim() } : {}),
      ...(input.qty != null ? { qty: input.qty } : {}),
      revenueCode,
      ...(input.basketRef ? { basketRef: input.basketRef } : {}),
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
