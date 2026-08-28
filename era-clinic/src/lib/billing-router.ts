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

export type BillingTargetKind = "FINANCE" | "HOTEL_FOLIO" | "SETTLEMENT_HUB";

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
    await postHotelRoomCharge({
      reservationId: visit.reservationId,
      roomNumber: visit.roomNumber ?? undefined,
      amount: amountNet,
      description: `Clinic visit ${visit.id}`,
      externalTicketId: `clinic-visit-${visit.id}`,
    });
    return { channel: "hotel_folio" as const };
  }

  if (target === "SETTLEMENT_HUB" && amountNet > 0) {
    const pending = await postHotelSettlementPending({
      sourceRef: visit.id,
      amount: amountNet,
      description: `Clinic visit ${visit.id}`,
      payerLabel: visit.patientRef.refCode,
      globalPersonId: visit.patientRef.globalPersonId ?? undefined,
      idempotencyKey: `clinic-visit-${visit.id}`,
    });
    await prisma.visit.update({
      where: { id: visit.id },
      data: {
        billingTarget: "SETTLEMENT_HUB",
        settlementPendingId: pending.id as string,
      },
    });
    return { channel: "settlement_hub" as const, pendingId: pending.id as string };
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

export async function postHotelRoomCharge(input: {
  reservationId?: string;
  roomNumber?: string;
  amount: number;
  description: string;
  externalTicketId: string;
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
  const res = await fetch(`${base}/api/pos/room-charge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pos-bridge-secret": secret,
      "x-era-organization-id": hotelOrganizationId,
      "Idempotency-Key": input.externalTicketId,
    },
    body: JSON.stringify({
      organizationId: hotelOrganizationId,
      reservationId: input.reservationId,
      roomNumber: input.roomNumber,
      revenueCode: "MEDICAL",
      amount: input.amount,
      description: input.description,
      externalTicketId: input.externalTicketId,
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
