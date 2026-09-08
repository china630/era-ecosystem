/**
 * CLI-57 — paid extras: prescribe → PENDING_PAY → Pay → place + ticket ×3.
 */
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { placeConfirmedProcedures } from "@/lib/treatment-planner.service";
import { episodeAnamnesisDenied, ANAMNESIS_REQUIRED } from "@/domain/sanatorium/episode-gates";
import {
  CARE_TEAM_REQUIRED,
  episodeCareTeamDenied,
} from "@/domain/sanatorium/episode-care-team-gates";
import { countEpisodeCareDoctors } from "@/domain/sanatorium/episode-care-team.service";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";
import { resolveProcedureCharge } from "@/domain/procedure/procedure-charge.service";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { postHotelRoomCharge, resolveBillingTarget } from "@/lib/billing-router";
import {
  extraTicketIdForOrder,
  isClinicElektrawebDualRun,
} from "@/domain/procedure/extra-ticket";
import { postHotelElektrawebOutbox } from "@/lib/elektraweb-outbox-client";
import {
  getClinicHotelOrganizationId,
  resolveClinicCutoverOrgId,
} from "@/domain/physio/clinic-cutover.service";
import { enterSatelliteTenant } from "@era/satellite-kit";

export type ExtraPrescribeLine = {
  procedureCode: string;
  qty: number;
  note?: string | null;
  bodyPart?: string | null;
  physioFields?: Record<string, unknown> | null;
  siteIds?: string[];
  siteApplyMode?: "TURN" | "TOGETHER" | null;
  siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
};

async function loadEpisode(episodeId: string) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: { patientRef: true },
  });
  if (!episode) throw new PackageAssignError("Episode not found", "NOT_FOUND", 404);
  if (episode.status !== "OPEN") {
    throw new PackageAssignError("Episode is not OPEN", "NOT_OPEN");
  }
  const anamnesisDenied = episodeAnamnesisDenied(episode.anamnesisText);
  if (anamnesisDenied) {
    throw new PackageAssignError(anamnesisDenied, ANAMNESIS_REQUIRED);
  }
  const careDenied = episodeCareTeamDenied(await countEpisodeCareDoctors(episodeId));
  if (careDenied) {
    throw new PackageAssignError(careDenied, CARE_TEAM_REQUIRED);
  }
  return episode;
}

async function listPriceForCode(procedureCode: string): Promise<number> {
  const catalog = await prisma.serviceCatalogCache.findFirst({
    where: { code: procedureCode },
  });
  const n = catalog ? Number(catalog.amount) : 0;
  return n > 0 ? n : 25;
}

/** Doctor prescribe: PENDING_PAY only (not on schedule). */
export async function prescribeExtras(
  episodeId: string,
  lines: ExtraPrescribeLine[],
): Promise<{ orderIds: string[] }> {
  const episode = await loadEpisode(episodeId);
  const types = await prisma.procedureType.findMany();
  const typeByCode = new Map(types.map((t) => [t.code, t]));
  const orgId = requestOrganizationId();
  const ids: string[] = [];
  const now = new Date();
  let seq = 0;

  for (const line of lines) {
    if (line.qty < 1) continue;
    const pt = typeByCode.get(line.procedureCode);
    if (!pt) {
      throw new PackageAssignError(
        `Unknown procedure type ${line.procedureCode}`,
        "UNKNOWN_TYPE",
        400,
      );
    }
    const unitPrice = await listPriceForCode(line.procedureCode);
    const duration = pt.durationMin ?? 30;
    for (let i = 0; i < line.qty; i++) {
      const scheduledAt = new Date(now.getTime() + seq * 60_000);
      const order = await prisma.procedureOrder.create({
        data: {
          organizationId: orgId,
          patientRefId: episode.patientRefId,
          clinicalEpisodeId: episodeId,
          procedureTypeId: pt.id,
          procedureCode: line.procedureCode,
          procedureName: pt.name,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + duration * 60_000),
          sequenceIndex: seq++,
          bodyPart: line.bodyPart ?? pt.bodyPart ?? undefined,
          status: "PENDING_PAY",
          note: line.note ?? undefined,
          physioFields: line.physioFields ?? undefined,
          siteApplyMode: line.siteApplyMode ?? undefined,
          patientOrigin: episode.patientOrigin,
          reservationId: episode.reservationId ?? undefined,
          amountNet: unitPrice,
          bonusEligible: true,
          inPackage: false,
        },
      });
      if (line.siteIds?.length) {
        await prisma.procedureOrderSite.createMany({
          data: line.siteIds.map((siteId, sortOrder) => ({
            organizationId: orgId,
            procedureOrderId: order.id,
            siteId,
            sortOrder,
            laterality: line.siteLaterality?.[siteId] ?? undefined,
          })),
        });
      }
      ids.push(order.id);
    }
  }
  return { orderIds: ids };
}

export async function listPendingExtras(episodeId: string) {
  return prisma.procedureOrder.findMany({
    where: { clinicalEpisodeId: episodeId, status: "PENDING_PAY" },
    orderBy: { createdAt: "asc" },
  });
}

/** List prices for extras catalog UI (code → AZN). */
export async function listExtraUnitPrices(): Promise<Record<string, number>> {
  const rows = await prisma.serviceCatalogCache.findMany({
    select: { code: true, amount: true },
    take: 5000,
  });
  const out: Record<string, number> = {};
  for (const r of rows) {
    const n = Number(r.amount);
    if (r.code && n > 0) out[r.code] = n;
  }
  return out;
}

export async function deletePendingExtra(orderId: string): Promise<void> {
  const order = await prisma.procedureOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new PackageAssignError("Not found", "NOT_FOUND", 404);
  if (order.status !== "PENDING_PAY") {
    throw new PackageAssignError("Only PENDING_PAY can be deleted here", "INVALID_STATUS", 400);
  }
  await prisma.procedureOrder.delete({ where: { id: orderId } });
}

/**
 * Reception Pay: all-or-nothing — charge all → place all → ticket all.
 * Requires paymentReceiptRef (guest payment proof). Walk-in must have receipt; in-house may use folio.
 * On any charge failure: leave all as PENDING_PAY (rollback status flips).
 */
export async function payAndScheduleExtras(
  orderIds: string[],
  actorUserId: string,
  organizationId?: string | null,
  opts?: { paymentReceiptRef?: string | null },
): Promise<{ printPaths: string[]; placed: number; orders: unknown[] }> {
  if (!orderIds.length) {
    throw new PackageAssignError("No procedures selected", "INVALID", 400);
  }
  const receipt = opts?.paymentReceiptRef?.trim();
  if (!receipt) {
    throw new PackageAssignError(
      "Payment receipt reference required before Pay",
      "RECEIPT_REQUIRED",
      400,
    );
  }

  const orgId = resolveClinicCutoverOrgId(organizationId);
  enterSatelliteTenant({ organizationId: orgId });

  const orders = await prisma.procedureOrder.findMany({
    where: { id: { in: orderIds }, status: "PENDING_PAY" },
    include: { patientRef: true },
  });
  if (orders.length === 0) {
    throw new PackageAssignError("No PENDING_PAY orders", "NOT_FOUND", 404);
  }

  const dualRun = await isClinicElektrawebDualRun(orgId);
  const hotelOrganizationId = dualRun
    ? await getClinicHotelOrganizationId(orgId)
    : null;

  // Phase 1: receipt already required. Walk-in without reservation = FO cash already taken (receipt).
  // In-house without dual-run uses hotel folio when reservationId present.

  // Phase 2: charge all first; on failure leave PENDING_PAY (nothing placed yet)
  const chargedMeta: Array<{ orderId: string; amount: number; ticketId: string }> = [];
  try {
    for (const order of orders) {
      const charge = await resolveProcedureCharge(order, { burnQuota: false });
      const amount = charge.amountNet > 0 ? charge.amountNet : Number(order.amountNet);
      const ticketId = extraTicketIdForOrder(order.id);
      const description = order.procedureName;

      if (dualRun && hotelOrganizationId) {
        await postHotelElektrawebOutbox({
          hotelOrganizationId,
          idempotencyKey: `pay-${ticketId}`,
          patientOrigin: order.patientOrigin === "IN_HOUSE" ? "IN_HOUSE" : "WALK_IN",
          reservationId: order.reservationId,
          procedureCode: order.procedureCode,
          procedureName: order.procedureName,
          amount,
          description,
        });
      } else if (order.reservationId) {
        const billingTarget = await resolveBillingTarget(order.patientOrigin);
        if (billingTarget === "HOTEL_FOLIO") {
          await postHotelRoomCharge({
            reservationId: order.reservationId,
            amount,
            description,
            externalTicketId: ticketId,
          });
        }
      }
      // Walk-in with receipt: FO already collected cash; clinic records receipt only.
      chargedMeta.push({ orderId: order.id, amount, ticketId });
    }
  } catch (err) {
    console.error("[extras] Pay charge batch failed — leaving PENDING_PAY", err);
    throw new PackageAssignError(
      err instanceof Error ? err.message : "Folio charge failed",
      "FOLIO_CHARGE_FAILED",
      502,
    );
  }

  // Phase 3: flip all to PROPOSED + receipt, then place, then tickets
  await prisma.procedureOrder.updateMany({
    where: { id: { in: chargedMeta.map((c) => c.orderId) } },
    data: {
      status: "PROPOSED",
      paymentReceiptRef: receipt,
      inPackage: false,
    },
  });
  for (const c of chargedMeta) {
    await prisma.procedureOrder.update({
      where: { id: c.orderId },
      data: { amountNet: c.amount },
    });
  }

  let placed = 0;
  try {
    placed = await placeConfirmedProcedures(
      chargedMeta.map((c) => c.orderId),
      { confirmedByUserId: actorUserId },
    );
  } catch (err) {
    // Rollback to PENDING_PAY so reception can retry
    await prisma.procedureOrder.updateMany({
      where: { id: { in: chargedMeta.map((c) => c.orderId) } },
      data: { status: "PENDING_PAY" },
    });
    throw err;
  }

  const printPaths: string[] = [];
  const issuedOrders = [];
  for (const c of chargedMeta) {
    const updated = await prisma.procedureOrder.update({
      where: { id: c.orderId },
      data: {
        extraTicketIssuedAt: new Date(),
        extraTicketId: c.ticketId,
      },
      include: { patientRef: true },
    });
    issuedOrders.push(updated);
    printPaths.push(`/print/extra-ticket/${c.ticketId}?autoprint=1`);
  }

  await recordClinicAudit(
    { userId: actorUserId },
    "ProcedureOrder",
    orders[0]!.id,
    "EXTRA_PAY_AND_SCHEDULE",
    { orderIds, placed, printPaths, paymentReceiptRef: receipt },
  );

  return { printPaths, placed, orders: issuedOrders };
}

/**
 * Cancel paid not-COMPLETED extra and post folio reversal (clinic-initiated).
 */
export async function cancelPaidExtraWithFolioReverse(
  orderId: string,
  actorUserId: string,
): Promise<void> {
  const order = await prisma.procedureOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new PackageAssignError("Not found", "NOT_FOUND", 404);
  if (!["SCHEDULED", "PROPOSED"].includes(order.status)) {
    throw new PackageAssignError(
      "Only SCHEDULED extras can be reversed from clinic",
      "INVALID_STATUS",
      400,
    );
  }
  if (Number(order.amountNet) <= 0) {
    throw new PackageAssignError("Not a paid extra", "NOT_PAID", 400);
  }

  const amount = Number(order.amountNet);
  if (order.reservationId) {
    try {
      await postHotelRoomCharge({
        reservationId: order.reservationId,
        amount: -amount,
        description: `Reverse: ${order.procedureName}`,
        externalTicketId: `rev-${order.extraTicketId ?? order.id}`,
      });
    } catch (err) {
      console.error("[extras] folio reverse failed", orderId, err);
      throw new PackageAssignError("Folio reverse failed", "FOLIO_REVERSE_FAILED", 502);
    }
  }

  await prisma.procedureOrder.update({
    where: { id: orderId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "clinic_extra_reverse",
    },
  });
  await recordClinicAudit(
    { userId: actorUserId },
    "ProcedureOrder",
    orderId,
    "EXTRA_FOLIO_REVERSE",
    { amount },
  );
}

/**
 * Hotel void inbound: cancel matching order + clear ticket.
 */
export async function applyHotelVoidToExtra(input: {
  externalTicketId?: string;
  orderId?: string;
}): Promise<{ cancelled: boolean }> {
  const order = input.orderId
    ? await prisma.procedureOrder.findUnique({ where: { id: input.orderId } })
    : input.externalTicketId
      ? await prisma.procedureOrder.findFirst({
          where: { extraTicketId: input.externalTicketId },
        })
      : null;
  if (!order) return { cancelled: false };
  if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(order.status)) {
    return { cancelled: false };
  }
  await prisma.procedureOrder.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "hotel_folio_void",
      extraTicketId: null,
      extraTicketIssuedAt: null,
    },
  });
  return { cancelled: true };
}

/** Purge PENDING_PAY when episode closes. */
export async function purgePendingExtrasForEpisode(episodeId: string): Promise<number> {
  const r = await prisma.procedureOrder.deleteMany({
    where: { clinicalEpisodeId: episodeId, status: "PENDING_PAY" },
  });
  return r.count;
}
