/**
 * CLI-57 — paid extras: prescribe → PENDING_PAY → Pay → place + ticket ×3.
 */
import { catalogUnitPrice } from "@/domain/catalog/catalog-price.service";
import { prisma } from "@/lib/prisma";
import { DEFAULT_OVER_QUOTA_AZN } from "@/domain/sanatorium/entitlement-charge.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { placeConfirmedProcedures } from "@/lib/treatment-planner.service";
import { episodeAnamnesisDenied, ANAMNESIS_REQUIRED } from "@/domain/sanatorium/episode-gates";
import {
  CARE_TEAM_REQUIRED,
  episodeCareTeamDenied,
} from "@/domain/sanatorium/episode-care-team-gates";
import { countEpisodeCareDoctors } from "@/domain/sanatorium/episode-care-team.service";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";
import { releaseProcedureOccupancy } from "@/domain/procedure/procedure-allocation.service";
import { allocateClinicReceiptNo } from "@/domain/cashier/receipt-seq.service";
import {
  postProcedureFolioCharge,
  resolveProcedureCharge,
} from "@/domain/procedure/procedure-charge.service";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { postHotelRoomCharge, revenueCodeForServiceLine, tryResolveSellableSku } from "@/lib/billing-router";
import {
  extraTicketIdForOrder,
  extraTicketPrintPath,
} from "@/domain/procedure/extra-ticket";
import {
  getClinicHotelOrganizationId,
  resolveClinicCutoverOrgId,
} from "@/domain/physio/clinic-cutover.service";
import { enterSatelliteTenant } from "@era/satellite-kit";
import { loadCatalogDisplayNameMap } from "@/domain/catalog/catalog-display-name.service";

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

/** Extras are always paid, so they take the catalog price (quota does not apply). */
async function listPriceForCode(procedureCode: string): Promise<number> {
  const { applyPriceMissingFallback, resolveEntitlementCharge } = await import(
    "@/domain/sanatorium/entitlement-charge.service"
  );
  const charge = applyPriceMissingFallback(
    await resolveEntitlementCharge({
      patientOrigin: "WALK_IN",
      serviceCode: procedureCode,
    }),
    { serviceCode: procedureCode, where: "extras" },
  );
  return charge.amountNet;
}

/**
 * Balance code that still has unused package quota for this procedure
 * (the line itself, or a block that lists it). Null when it may be a paid extra.
 */
export async function remainingPackageQuotaCode(
  episodeId: string,
  procedureCode: string,
): Promise<string | null> {
  const instance = await prisma.programInstance.findFirst({
    where: { episodeId },
    select: {
      templateId: true,
      procedureLines: { select: { procedureCode: true, quotaTotal: true } },
    },
  });
  if (!instance) return null;
  const memberOf = await prisma.programTemplateBlockMember.findMany({
    where: { templateId: instance.templateId, procedureCode },
    select: { blockCode: true },
  });
  const quotaCodes = [procedureCode, ...memberOf.map((m) => m.blockCode)];
  for (const code of quotaCodes) {
    const line = instance.procedureLines.find((l) => l.procedureCode === code);
    if (!line || line.quotaTotal <= 0) continue;
    const used = await prisma.procedureOrder.count({
      where: {
        clinicalEpisodeId: episodeId,
        inPackage: true,
        status: { in: ["SCHEDULED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] },
        OR: [{ procedureCode: code }, { packageQuotaCode: code }],
      },
    });
    if (line.quotaTotal - used > 0) return code;
  }
  return null;
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
    // Overflow past package quota is a paid extra. Quota no longer blocks the write.
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
    select: { code: true, amount: true, listAmount: true },
    take: 5000,
  });
  const out: Record<string, number> = {};
  for (const r of rows) {
    const n = catalogUnitPrice(r);
    if (!r.code) continue;
    if (n > 0) out[r.code] = n;
    else if (!(out[r.code] > 0)) out[r.code] = DEFAULT_OVER_QUOTA_AZN;
  }
  return out;
}

const PAID_EXTRA_STATUSES = ["SCHEDULED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] as const;

/** Paid extras already on the schedule. Not editable from the package modal. */
export async function listPaidExtras(episodeId: string) {
  return prisma.procedureOrder.findMany({
    where: {
      clinicalEpisodeId: episodeId,
      inPackage: false,
      status: { in: [...PAID_EXTRA_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
  });
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
 * Reception Pay: all-or-nothing — one system receipt for the batch, then charge all → place all.
 * The receipt number is yyyymmdd-xxx (Baku day, per organization). It is written on every order
 * and appended to the folio / Elektraweb description.
 * On any charge failure: leave all as PENDING_PAY (rollback status flips).
 */
export type ExtraBatchLine = { id: string; name: string; reason?: string };

export async function payAndScheduleExtras(
  orderIds: string[],
  actorUserId: string,
  organizationId?: string | null,
  opts?: { paymentReceiptRef?: string | null; locale?: string | null },
): Promise<{
  printPaths: string[];
  placed: number;
  orders: unknown[];
  paymentReceiptRef: string;
  accepted: ExtraBatchLine[];
  rejected: ExtraBatchLine[];
}> {
  if (!orderIds.length) {
    throw new PackageAssignError("No procedures selected", "INVALID", 400);
  }

  const orgId = resolveClinicCutoverOrgId(organizationId);
  const receipt = await allocateClinicReceiptNo(orgId);
  enterSatelliteTenant({ organizationId: orgId });

  const requested = await prisma.procedureOrder.findMany({
    where: { id: { in: orderIds } },
    include: { patientRef: true },
  });
  const byId = new Map(requested.map((row) => [row.id, row]));
  const accepted: ExtraBatchLine[] = [];
  const rejected: ExtraBatchLine[] = [];
  const chargedMeta: Array<{ orderId: string; amount: number; ticketId: string }> = [];

  const hotelOrganizationId = await getClinicHotelOrganizationId(orgId);
  const catalogNames = await loadCatalogDisplayNameMap(
    requested.map((row) => row.procedureCode),
    opts?.locale || "az",
  );
  const displayName = (order: { procedureCode: string; procedureName: string }) =>
    catalogNames.get(order.procedureCode) || order.procedureName;

  for (const id of orderIds) {
    const order = byId.get(id);
    if (!order || order.status !== "PENDING_PAY") {
      rejected.push({
        id,
        name: order ? displayName(order) : id,
        reason: "status is not PENDING_PAY",
      });
      continue;
    }
    try {
      const charge = await resolveProcedureCharge(order, { burnQuota: false });
      const amount = charge.amountNet > 0 ? charge.amountNet : Number(order.amountNet);
      if (!(amount > 0)) {
        rejected.push({ id: order.id, name: displayName(order), reason: "amount is 0" });
        continue;
      }
      const ticketId = extraTicketIdForOrder(order.id);
      const description = `${displayName(order)} · çek ${receipt}`;
      if (order.patientOrigin === "IN_HOUSE") {
        if (!order.reservationId) {
          rejected.push({
            id: order.id,
            name: displayName(order),
            reason: "no hotel reservation",
          });
          continue;
        }
        await postProcedureFolioCharge({
          hotelOrganizationId: hotelOrganizationId ?? undefined,
          reservationId: order.reservationId,
          amount,
          description,
          externalTicketId: ticketId,
          procedureCode: order.procedureCode,
          qty: order.quantity,
        });
        chargedMeta.push({ orderId: order.id, amount, ticketId });
        accepted.push({ id: order.id, name: displayName(order) });
        continue;
      }
      const { postHotelSettlementPending } = await import("@/lib/settlement-hub-client");
      const sku = await tryResolveSellableSku(order.procedureCode);
      if (!sku) {
        rejected.push({ id: order.id, name: displayName(order), reason: "no SKU" });
        continue;
      }
      await postHotelSettlementPending({
        sourceRef: order.id,
        amount,
        description,
        payerLabel: order.patientRef.fullName,
        idempotencyKey: ticketId,
        sku,
        qty: order.quantity,
      });
      rejected.push({
        id: order.id,
        name: displayName(order),
        reason: "waiting for hotel payment",
      });
    } catch (err) {
      rejected.push({
        id: order.id,
        name: displayName(order),
        reason: err instanceof Error ? err.message : "hotel rejected the line",
      });
    }
  }

  if (chargedMeta.length === 0) {
    return {
      printPaths: [],
      placed: 0,
      orders: [],
      paymentReceiptRef: receipt,
      accepted,
      rejected,
    };
  }

  await prisma.procedureOrder.updateMany({
    where: { id: { in: chargedMeta.map((c) => c.orderId) } },
    data: {
      status: "PROPOSED",
      paymentReceiptRef: opts?.paymentReceiptRef?.trim() || receipt,
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
    placed = (
      await placeConfirmedProcedures(
        chargedMeta.map((c) => c.orderId),
        { confirmedByUserId: actorUserId },
      )
    ).placed;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "schedule failed";
    for (const line of accepted) {
      line.reason = reason;
    }
  }

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
  }
  // One paper cheque lists every line on this receipt. Folio keys stay per order.
  const printPaths = chargedMeta.length
    ? [extraTicketPrintPath(chargedMeta[0]!.ticketId, orgId)]
    : [];

  await recordClinicAudit(
    { userId: actorUserId },
    "ProcedureOrder",
    chargedMeta[0]!.orderId,
    "EXTRA_PAY_AND_SCHEDULE",
    { orderIds, placed, printPaths, paymentReceiptRef: receipt, accepted, rejected },
  );

  return { printPaths, placed, orders: issuedOrders, paymentReceiptRef: receipt, accepted, rejected };
}

/** Walk-in extra becomes a plan and a ticket only after the hotel cashier confirms payment. */
export async function scheduleWalkInExtraAfterSettlement(orderId: string): Promise<boolean> {
  const order = await prisma.procedureOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING_PAY" || order.patientOrigin === "IN_HOUSE") {
    return false;
  }
  const ticketId = extraTicketIdForOrder(order.id);
  await prisma.procedureOrder.update({
    where: { id: order.id },
    data: { status: "PROPOSED", inPackage: false },
  });
  await placeConfirmedProcedures([order.id], {});
  await prisma.procedureOrder.update({
    where: { id: order.id },
    data: { extraTicketIssuedAt: new Date(), extraTicketId: ticketId },
  });
  return true;
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
      const productSku = await tryResolveSellableSku(order.procedureCode);
      const revenueCode = await revenueCodeForServiceLine(order.procedureCode);
      await postHotelRoomCharge({
        reservationId: order.reservationId,
        amount: -amount,
        description: `Reverse: ${order.procedureName}`,
        externalTicketId: `rev-${order.extraTicketId ?? order.id}`,
        productSku: productSku ?? undefined,
        qty: order.quantity,
        revenueCode,
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
  await releaseProcedureOccupancy([orderId]);
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
}): Promise<{ cancelled: boolean; reason?: string }> {
  const order = input.orderId
    ? await prisma.procedureOrder.findUnique({ where: { id: input.orderId } })
    : input.externalTicketId
      ? await prisma.procedureOrder.findFirst({
          where: { extraTicketId: input.externalTicketId },
        })
      : null;
  if (!order) return { cancelled: false, reason: "not_found" };
  if (["COMPLETED", "CANCELLED", "CHECKED_IN"].includes(order.status)) {
    return { cancelled: false, reason: "received" };
  }
  if (order.status === "NO_SHOW") {
    const { getClinicSettings } = await import("@/domain/settings/settings.service");
    const settings = await getClinicSettings();
    if (settings.noShowKeepsCharge) return { cancelled: false, reason: "received" };
  }
  if (order.status === "SCHEDULED" || order.status === "PROPOSED") {
    await releaseProcedureOccupancy([order.id]);
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
