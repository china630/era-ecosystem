import {
  SATELLITE_CLINIC_VISIT_COMPLETED,
  type PatientOrigin,
} from "@era/contracts";
import {
  resolveOperatingMode,
  satelliteOrganizationId,
  shouldRouteRevenueToParent,
} from "@era/satellite-kit";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";

export async function completeVisitBilling(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { patientRef: true, serviceLines: true },
  });
  if (!visit) throw new Error("Visit not found");

  const amountNet = Number(visit.amountNet);
  const target =
    visit.billingTarget === "HOTEL_FOLIO"
      ? "HOTEL_FOLIO"
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

  await dispatchSatelliteEvent({
    type: SATELLITE_CLINIC_VISIT_COMPLETED,
    globalPersonId: visit.patientRef.globalPersonId ?? undefined,
    payload: {
      visitId: visit.id,
      patientRef: visit.patientRef.refCode,
      serviceCodes: visit.serviceLines.map((l) => l.serviceCode),
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
}) {
  const base = (process.env.HOTEL_PMS_URL ?? "http://127.0.0.1:3201").replace(
    /\/$/,
    "",
  );
  const secret = process.env.POS_BRIDGE_SECRET ?? process.env.CLINIC_BRIDGE_SECRET;
  if (!secret) throw new Error("POS_BRIDGE_SECRET not configured");
  const res = await fetch(`${base}/api/pos/room-charge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pos-bridge-secret": secret,
      "Idempotency-Key": input.externalTicketId,
    },
    body: JSON.stringify({
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
 * Only in-house guests can route to the hotel folio, and only when this org is
 * configured as a DEPARTMENT whose revenue routes to the parent (hotel).
 * Otherwise revenue is booked under the org's own VOEN via a finance event.
 */
export async function resolveBillingTarget(
  origin: PatientOrigin,
): Promise<"FINANCE" | "HOTEL_FOLIO"> {
  if (origin !== "IN_HOUSE") return "FINANCE";
  const mode = await resolveOperatingMode(satelliteOrganizationId());
  return shouldRouteRevenueToParent(mode) ? "HOTEL_FOLIO" : "FINANCE";
}
