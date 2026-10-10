import {
  SATELLITE_CLINIC_VISIT_COMPLETED,
  type PatientOrigin,
} from "@era/contracts";
import {
  resolveOperatingMode,
  resolveSettlementPolicy,
  shouldDeferWalkInToHub,
  shouldRouteRevenueToParent,
} from "@era/satellite-kit";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { postHotelSettlementPending } from "@/lib/settlement-hub-client";
import { getClinicHotelOrganizationId } from "@/domain/physio/clinic-cutover.service";
import { getDefaultTenant } from "@/domain/settings/settings.service";

export type BillingTargetKind = "FINANCE" | "HOTEL_FOLIO" | "SETTLEMENT_HUB";

export type ClinicHotelLine = {
  serviceCode: string;
  description: string;
  amount: number;
  qty?: number;
};

function hotelQty(qty: number | undefined): number {
  const n = Math.round(Number(qty ?? 1));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function allocateAmounts(weights: number[], total: number): number[] {
  if (weights.length === 0) return [];
  const roundedTotal = Math.round(total * 100) / 100;
  const gross = weights.reduce((sum, weight) => sum + weight, 0);
  if (gross <= 0) {
    const amounts = weights.map(() => 0);
    amounts[amounts.length - 1] = roundedTotal;
    return amounts;
  }
  const amounts = weights.map(
    (weight) => Math.round((weight / gross) * roundedTotal * 100) / 100,
  );
  const drift =
    Math.round((roundedTotal - amounts.reduce((sum, amount) => sum + amount, 0)) * 100) / 100;
  amounts[amounts.length - 1] = Math.round((amounts[amounts.length - 1]! + drift) * 100) / 100;
  return amounts;
}

export async function resolveSellableSku(serviceCode: string): Promise<string> {
  const code = serviceCode.trim();
  if (!code) throw new Error("Finance SKU is required");
  const procedure = await prisma.procedureType.findFirst({
    where: { code },
    select: { financeSku: true },
  });
  const fromProcedure = procedure?.financeSku?.trim();
  if (fromProcedure) return fromProcedure;
  const diagnostic = await prisma.diagnosticService.findFirst({
    where: { OR: [{ code }, { serviceCode: code }] },
    select: { financeSku: true },
  });
  const fromDiagnostic = diagnostic?.financeSku?.trim();
  if (fromDiagnostic) return fromDiagnostic;
  const catalog = await prisma.serviceCatalogCache.findFirst({
    where: { code },
    select: { code: true },
  });
  if (catalog?.code?.trim()) return catalog.code.trim();
  throw new Error(`Finance SKU is required for ${code}`);
}

export async function tryResolveSellableSku(serviceCode: string): Promise<string | null> {
  try {
    return await resolveSellableSku(serviceCode);
  } catch {
    return null;
  }
}

export async function completeVisitBilling(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { patientRef: true, serviceLines: true },
  });
  if (!visit) throw new Error("Visit not found");

  const amountNet = Number(visit.amountNet);
  const target: BillingTargetKind =
    visit.billingTarget === "HOTEL_FOLIO"
      ? "HOTEL_FOLIO"
      : visit.billingTarget === "SETTLEMENT_HUB"
        ? "SETTLEMENT_HUB"
        : await resolveBillingTarget(visit.patientOrigin);

  if (target === "HOTEL_FOLIO" && visit.reservationId) {
    await postClinicHotelLines({
      kind: "folio",
      reservationId: visit.reservationId,
      roomNumber: visit.roomNumber ?? undefined,
      sourceRef: visit.id,
      idempotencyPrefix: `clinic-visit-${visit.id}`,
      payerLabel: visit.patientRef.refCode,
      lines: visit.serviceLines.map((line) => ({
        serviceCode: line.serviceCode,
        description: line.description,
        amount: Number(line.amount ?? 0),
      })),
      amountNet,
    });
    return { channel: "hotel_folio" as const };
  }

  if (target === "SETTLEMENT_HUB" && (amountNet > 0 || visit.serviceLines.length > 0)) {
    if (visit.serviceLines.length === 0) {
      throw new Error("Finance SKU is required for the visit");
    }
    const posted = await postClinicHotelLines({
      kind: "pending",
      sourceRef: visit.id,
      idempotencyPrefix: `clinic-visit-${visit.id}`,
      payerLabel: visit.patientRef.refCode,
      globalPersonId: visit.patientRef.globalPersonId ?? undefined,
      lines: visit.serviceLines.map((line) => ({
        serviceCode: line.serviceCode,
        description: line.description,
        amount: Number(line.amount ?? 0),
      })),
      amountNet,
    });
    const pendingId = posted.ids.length > 1 ? JSON.stringify(posted.ids) : posted.firstId;
    await prisma.visit.update({
      where: { id: visit.id },
      data: {
        billingTarget: "SETTLEMENT_HUB",
        settlementPendingId: pendingId,
      },
    });
    return { channel: "settlement_hub" as const, pendingId };
  }

  await dispatchSatelliteEvent({
    type: SATELLITE_CLINIC_VISIT_COMPLETED,
    globalPersonId: visit.patientRef.globalPersonId ?? undefined,
    payload: {
      visitId: visit.id,
      patientRef: visit.patientRef.refCode,
      serviceCodes: visit.serviceLines.map((l: { serviceCode: string }) => l.serviceCode),
      amountNet,
      currency: "AZN",
    },
  });
  return { channel: "finance" as const };
}

export async function postClinicHotelLines(input: {
  kind: "folio" | "pending";
  reservationId?: string;
  roomNumber?: string;
  sourceRef: string;
  idempotencyPrefix: string;
  payerLabel?: string;
  globalPersonId?: string;
  lines: ClinicHotelLine[];
  amountNet: number;
  revenueCode?: "FOOD" | "MEDICAL" | "RETAIL";
  hotelOrganizationId?: string;
}): Promise<{ firstId: string; ids: string[] }> {
  if (input.lines.length === 0) throw new Error("Finance SKU is required");
  const amounts = allocateAmounts(
    input.lines.map((line) => line.amount),
    input.amountNet,
  );
  const ids: string[] = [];
  let firstId = "";
  for (let index = 0; index < input.lines.length; index += 1) {
    const line = input.lines[index]!;
    const productSku = await resolveSellableSku(line.serviceCode);
    const qty = hotelQty(line.qty);
    const key = input.lines.length === 1 ? input.idempotencyPrefix : `${input.idempotencyPrefix}-${index}`;
    if (input.kind === "folio") {
      const charge = (await postHotelRoomCharge({
        reservationId: input.reservationId,
        roomNumber: input.roomNumber,
        amount: amounts[index] ?? 0,
        description: line.description || `Clinic ${line.serviceCode}`,
        externalTicketId: key,
        productSku,
        qty,
        revenueCode: input.revenueCode,
        hotelOrganizationId: input.hotelOrganizationId,
      })) as { id?: string };
      const chargeId = String(charge.id ?? key);
      ids.push(chargeId);
      if (!firstId) firstId = chargeId;
    } else {
      const pending = await postHotelSettlementPending({
        sourceRef: input.sourceRef,
        amount: amounts[index] ?? 0,
        description: line.description || `Clinic ${line.serviceCode}`,
        payerLabel: input.payerLabel,
        globalPersonId: input.globalPersonId,
        idempotencyKey: key,
        sku: productSku,
        qty,
        revenueCode: input.revenueCode ?? "MEDICAL",
      });
      const pendingId = String((pending as { id?: string }).id ?? "");
      if (pendingId) ids.push(pendingId);
      if (!firstId) firstId = pendingId;
    }
  }
  return { firstId, ids };
}

/** Explicit caller code wins (RETAIL). Otherwise the clinic setting. Empty setting refuses the folio post. */
export async function resolveHotelFolioRevenueCode(explicit?: string | null): Promise<string> {
  const given = explicit?.trim();
  if (given) return given;
  const tenant = await getDefaultTenant();
  const code = tenant.hotelFolioRevenueCode?.trim() ?? "";
  if (!code) {
    throw new Error("Hotel folio revenue code is not configured");
  }
  return code;
}

export async function postHotelRoomCharge(input: {
  reservationId?: string;
  roomNumber?: string;
  amount: number;
  description: string;
  externalTicketId: string;
  productSku?: string;
  qty?: number;
  revenueCode?: string;
  /** Hotel org in SHARED pool (required). */
  hotelOrganizationId?: string;
}) {
  const base = (
    process.env.HOTEL_PMS_URL?.trim() ||
    process.env.ERA_HOTEL_PMS_ORIGIN?.trim() ||
    "http://127.0.0.1:3201"
  ).replace(/\/$/, "");
  const secret = process.env.POS_BRIDGE_SECRET ?? process.env.CLINIC_BRIDGE_SECRET;
  if (!secret) throw new Error("POS_BRIDGE_SECRET not configured");
  const hotelOrganizationId =
    input.hotelOrganizationId?.trim() ||
    (await getClinicHotelOrganizationId()) ||
    undefined;
  if (!hotelOrganizationId) {
    throw new Error("hotelOrganizationId required for hotel room charge");
  }
  const revenueCode = await resolveHotelFolioRevenueCode(input.revenueCode);
  const ticket = input.externalTicketId.trim();
  const ticketIsUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      ticket,
    );
  const res = await fetch(`${base}/api/pos/room-charge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pos-bridge-secret": secret,
      "x-era-organization-id": hotelOrganizationId,
      "Idempotency-Key": ticket,
    },
    body: JSON.stringify({
      organizationId: hotelOrganizationId,
      reservationId: input.reservationId,
      roomNumber: input.roomNumber,
      revenueCode,
      amount: input.amount,
      qty: hotelQty(input.qty),
      description: input.description,
      ...(input.productSku?.trim() ? { productSku: input.productSku.trim() } : {}),
      ...(ticketIsUuid ? { externalTicketId: ticket } : { ticketNumber: ticket }),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hotel folio charge failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Decide where a visit's revenue settles, honoring the org operating mode.
 */
export async function resolveBillingTarget(
  origin: PatientOrigin,
): Promise<BillingTargetKind> {
  if (origin === "IN_HOUSE") {
    const mode = await resolveOperatingMode(requestOrganizationId());
    return shouldRouteRevenueToParent(mode) ? "HOTEL_FOLIO" : "FINANCE";
  }
  const orgId = requestOrganizationId();
  const policy = await resolveSettlementPolicy(orgId);
  return shouldDeferWalkInToHub(policy) ? "SETTLEMENT_HUB" : "FINANCE";
}

export async function isWalkInDeferredToHub(): Promise<boolean> {
  const orgId = requestOrganizationId();
  const policy = await resolveSettlementPolicy(orgId);
  return shouldDeferWalkInToHub(policy);
}
