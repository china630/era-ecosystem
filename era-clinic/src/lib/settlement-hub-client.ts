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
  revenueCode?: "FOOD" | "MEDICAL" | "RETAIL";
}) {
  const base = (process.env.HOTEL_PMS_URL ?? "http://127.0.0.1:3201").replace(/\/$/, "");
  const secret = process.env.POS_BRIDGE_SECRET ?? process.env.CLINIC_BRIDGE_SECRET;
  if (!secret) throw new Error("POS_BRIDGE_SECRET not configured");
  const orgId = requestOrganizationId();
  const hotelOrganizationId = (await getClinicHotelOrganizationId()) ?? undefined;
  if (!hotelOrganizationId) {
    throw new Error("hotelOrganizationId required for hotel pending charge");
  }

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
      ...(input.revenueCode ? { revenueCode: input.revenueCode } : {}),
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
