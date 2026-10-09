import { requestOrganizationId } from "@/lib/request-organization";

export type PostHotelPendingInput = {
  sourceSystem: "FNB_POS" | "CLINIC";
  sourceRef: string;
  amount: number;
  description: string;
  payerLabel?: string;
  globalPersonId?: string;
  idempotencyKey: string;
  sku?: string;
  qty?: number;
  revenueCode?: "FOOD" | "MEDICAL" | "RETAIL";
};

async function hotelOrganizationId(): Promise<string> {
  const { resolveOperatingMode, resolveSettlementPolicy } = await import("@era/satellite-kit");
  const orgId = requestOrganizationId();
  const [mode, policy] = await Promise.all([
    resolveOperatingMode(orgId),
    resolveSettlementPolicy(orgId),
  ]);
  const hotelOrg = policy.hubOrganizationId?.trim() || mode.parentOrgId?.trim() || "";
  if (!hotelOrg) throw new Error("hotelOrganizationId required for hotel pending charge");
  return hotelOrg;
}

export async function postHotelSettlementPending(input: PostHotelPendingInput) {
  const base = (process.env.HOTEL_PMS_URL ?? process.env.PMS_BRIDGE_URL ?? "http://127.0.0.1:3201").replace(
    /\/$/,
    "",
  );
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) throw new Error("POS_BRIDGE_SECRET not configured");
  const orgId = requestOrganizationId();
  const hotelOrg = await hotelOrganizationId();

  const res = await fetch(`${base}/api/settlement/pending`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pos-bridge-secret": secret,
      Authorization: `Bearer ${secret}`,
      "x-era-organization-id": hotelOrg,
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      sourceSystem: input.sourceSystem,
      sourceOrgId: orgId,
      hotelOrganizationId: hotelOrg,
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
