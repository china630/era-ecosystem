/**
 * CLI-57 — paid extras: prescribe → PENDING_PAY → Pay → place + ticket ×3.
 */
import { catalogUnitPrice } from "@/domain/catalog/catalog-price.service";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
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
import { procedureFitsGuestSex } from "@/domain/procedure/procedure-sex-gate";
import { plansExtraBeforePay } from "@/domain/sanatorium/extra-procedure-route";
import { getClinicSettings } from "@/domain/settings/settings.service";
import { resolveExtraPrescriber } from "@/lib/extra-prescriber";

export type ExtraPrescribeLine = {
  procedureCode: string;
  qty: number;
  note?: string | null;
  bodyPart?: string | null;
  physioFields?: Record<string, unknown> | null;
  siteIds?: string[];
  siteApplyMode?: "TURN" | "TOGETHER" | null;
  siteLaterality?: Record<string, "LEFT" | "RIGHT" | "BOTH" | null>;
  preferredPractitionerId?: string | null;
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

/** Catalog list price only. A missing lab price stays missing (no default AZN). */
async function labListPrice(serviceCode: string): Promise<number> {
  const { resolveEntitlementCharge } = await import(
    "@/domain/sanatorium/entitlement-charge.service"
  );
  const charge = await resolveEntitlementCharge({
    patientOrigin: "WALK_IN",
    serviceCode,
  });
  if (charge.priceMissing) return 0;
  return charge.amountNet;
}

/** Paid lab over the package quota. A cheque row, not a lab order and not a cabin. */
async function prescribePaidLabOrders(input: {
  episode: {
    id: string;
    patientRefId: string;
    patientOrigin: string;
    reservationId: string | null;
    roomNumber: string | null;
  };
  line: ExtraPrescribeLine;
  orgId: string;
  prescribedByPractitionerId: string | null;
  now: Date;
  seqStart: number;
}): Promise<{ ids: string[]; seq: number } | null> {
  const service = await prisma.diagnosticService.findFirst({
    where: {
      active: true,
      organizationId: input.orgId,
      OR: [{ code: input.line.procedureCode }, { serviceCode: input.line.procedureCode }],
    },
    select: { code: true, serviceCode: true, titleAz: true, titleRu: true, titleEn: true },
  });
  if (!service) return null;
  const unitPrice = await labListPrice(service.serviceCode || service.code);
  if (!(unitPrice > 0)) {
    throw new PackageAssignError(
      `Lab ${input.line.procedureCode} has no price`,
      "NO_PRICE",
      400,
    );
  }
  const name = service.titleAz?.trim() || service.titleRu?.trim() || service.titleEn?.trim() || service.code;
  const ids: string[] = [];
  let seq = input.seqStart;
  for (let i = 0; i < input.line.qty; i++) {
    const scheduledAt = new Date(input.now.getTime() + seq * 60_000);
    const order = await prisma.procedureOrder.create({
      data: {
        organizationId: input.orgId,
        patientRefId: input.episode.patientRefId,
        clinicalEpisodeId: input.episode.id,
        procedureCode: service.code,
        procedureName: name,
        scheduledAt,
        endsAt: scheduledAt,
        sequenceIndex: seq++,
        status: "PENDING_PAY",
        note: input.line.note ?? undefined,
        patientOrigin: input.episode.patientOrigin === "WALK_IN" ? "WALK_IN" : "IN_HOUSE",
        reservationId: input.episode.reservationId ?? undefined,
        amountNet: unitPrice,
        bonusEligible: true,
        inPackage: false,
        prescribedByPractitionerId: input.prescribedByPractitionerId,
        schedulingMode: "OPEN",
      },
    });
    ids.push(order.id);
  }
  return { ids, seq };
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
  const quotaCodes = [
    procedureCode,
    `XFER-${procedureCode}`,
    ...memberOf.map((m) => m.blockCode),
  ];
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

/** Acting doctor, otherwise the earliest care doctor on the episode. */
async function resolvePrescriberForExtra(
  episodeId: string,
  actorUserId?: string | null,
): Promise<string | null> {
  const actor = actorUserId
    ? await prisma.practitioner.findFirst({
        where: { userId: actorUserId, active: true },
        select: { id: true, staffKind: true },
      })
    : null;
  const care = await prisma.episodeCareDoctor.findMany({
    where: { episodeId },
    orderBy: { assignedAt: "asc" },
    select: { practitionerId: true },
  });
  return resolveExtraPrescriber({
    actorPractitionerId: actor?.id ?? null,
    actorIsDoctor: actor?.staffKind === "DOCTOR",
    careDoctorIdsInAssignedOrder: care.map((row) => row.practitionerId),
  });
}

/**
 * Doctor prescribe. PLAN_BEFORE_PAY seats each row on its own day and cabin and
 * leaves it PENDING_PAY. HOLD_UNTIL_PAY keeps a placeholder clock and no cabin.
 */
export async function prescribeExtras(
  episodeId: string,
  lines: ExtraPrescribeLine[],
  actorUserId?: string | null,
): Promise<{ orderIds: string[] }> {
  const episode = await loadEpisode(episodeId);
  const planFirst = plansExtraBeforePay((await getClinicSettings()).extraProcedureRoute);
  const types = await prisma.procedureType.findMany();
  const typeByCode = new Map(types.map((t) => [t.code, t]));
  const orgId = requestOrganizationId();
  const ids: string[] = [];
  const now = new Date();
  const prescribedByPractitionerId = await resolvePrescriberForExtra(episodeId, actorUserId);
  let seq = 0;

  for (const line of lines) {
    if (line.qty < 1) continue;
    const openQuota = await remainingPackageQuotaCode(episodeId, line.procedureCode);
    if (openQuota?.toUpperCase().startsWith("XFER-")) {
      throw new PackageAssignError(
        "Use transferred package remaining before a paid extra",
        "QUOTA_REMAINING",
        409,
      );
    }
    // Overflow past package quota is a paid extra. Quota no longer blocks the write.
    const pt = typeByCode.get(line.procedureCode);
    if (!pt) {
      if (!episode.patientRefId) {
        throw new PackageAssignError("Episode has no patient", "NOT_FOUND", 404);
      }
      const labIds = await prescribePaidLabOrders({
        episode: {
          id: episode.id,
          patientRefId: episode.patientRefId,
          patientOrigin: episode.patientOrigin,
          reservationId: episode.reservationId,
          roomNumber: episode.roomNumber,
        },
        line,
        orgId,
        prescribedByPractitionerId,
        now,
        seqStart: seq,
      });
      if (!labIds) {
        throw new PackageAssignError(
          `Unknown procedure type ${line.procedureCode}`,
          "UNKNOWN_TYPE",
          400,
        );
      }
      ids.push(...labIds.ids);
      seq = labIds.seq;
      continue;
    }
    if (!(await procedureFitsGuestSex(line.procedureCode, episode.patientRef?.sex))) {
      throw new PackageAssignError(
        "Cabin sex does not match the guest",
        "CABIN_SEX",
        409,
      );
    }
    const { resolveMasseurId } = await import("@/domain/sanatorium/package-assign.service");
    const preferredPractitionerId = await resolveMasseurId(pt.id, line.preferredPractitionerId);
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
          preferredPractitionerId,
          prescribedByPractitionerId,
          schedulingMode: pt.openAttendance === true ? "OPEN" : "FIXED",
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
  if (planFirst && ids.length > 0) {
    const created = await prisma.procedureOrder.findMany({
      where: { id: { in: ids } },
      select: { id: true, schedulingMode: true },
    });
    const fixedIds = created
      .filter((row) => row.schedulingMode !== "OPEN")
      .map((row) => row.id);
    const openIds = created
      .filter((row) => row.schedulingMode === "OPEN")
      .map((row) => row.id);
    if (fixedIds.length > 0) await seatUnpaidExtras(fixedIds);
    // OPEN = day-bucket across stay (no cabin). Pay keeps the pin; nurse seats on arrival.
    if (openIds.length > 0) await pinUnpaidOpenExtras(openIds, episodeId);
  }
  return { orderIds: ids };
}

/** Place as PROPOSED, then return every row to PENDING_PAY so the cabin stays held. */
async function seatUnpaidExtras(ids: string[]): Promise<void> {
  await prisma.procedureOrder.updateMany({
    where: { id: { in: ids }, status: "PENDING_PAY" },
    data: { status: "PROPOSED" },
  });
  try {
    await placeConfirmedProcedures(ids, {});
  } finally {
    await prisma.procedureOrder.updateMany({
      where: { id: { in: ids }, status: { in: ["PROPOSED", "SCHEDULED"] } },
      data: { status: "PENDING_PAY" },
    });
  }
}

/** Pin OPEN unpaid extras onto consecutive working days until stay endsOn; keep PENDING_PAY. */
async function pinUnpaidOpenExtras(ids: string[], episodeId: string): Promise<void> {
  await prisma.procedureOrder.updateMany({
    where: { id: { in: ids }, status: "PENDING_PAY" },
    data: { status: "PROPOSED" },
  });
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    select: { programInstance: { select: { endsOn: true } } },
  });
  try {
    const { pinOpenAttendanceOrders } = await import(
      "@/domain/procedure/open-attendance"
    );
    await pinOpenAttendanceOrders(ids, {
      scheduleBefore: episode?.programInstance?.endsOn ?? undefined,
      startAt: new Date(),
    });
  } finally {
    await prisma.procedureOrder.updateMany({
      where: { id: { in: ids }, status: { in: ["PROPOSED", "SCHEDULED"] } },
      data: { status: "PENDING_PAY" },
    });
  }
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
        revenueCode: await revenueCodeForServiceLine(order.procedureCode),
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

  const receiptRef = opts?.paymentReceiptRef?.trim() || receipt;
  const planFirst = plansExtraBeforePay((await getClinicSettings()).extraProcedureRoute);
  const seatedIds = chargedMeta
    .filter((c) => byId.get(c.orderId)?.resourceId)
    .map((c) => c.orderId);
  const looseIds = chargedMeta
    .filter((c) => !byId.get(c.orderId)?.resourceId)
    .map((c) => c.orderId);
  const looseRows =
    looseIds.length > 0
      ? await prisma.procedureOrder.findMany({
          where: { id: { in: looseIds } },
          select: { id: true, schedulingMode: true },
        })
      : [];
  const openLoose = looseRows
    .filter((r) => r.schedulingMode === "OPEN")
    .map((r) => r.id);
  const fixedLoose = looseRows
    .filter((r) => r.schedulingMode !== "OPEN")
    .map((r) => r.id);
  // PLAN_BEFORE_PAY OPEN already has stay day-buckets — Pay must keep those clocks.
  const openKeepPin = planFirst ? openLoose : [];
  const openNeedPin = planFirst ? [] : openLoose;
  const keepScheduledIds = [...seatedIds, ...openKeepPin];
  const needPlaceIds = [...fixedLoose, ...openNeedPin];

  if (keepScheduledIds.length > 0) {
    await prisma.procedureOrder.updateMany({
      where: { id: { in: keepScheduledIds } },
      data: {
        status: "SCHEDULED",
        paymentReceiptRef: receiptRef,
        inPackage: false,
      },
    });
  }
  if (needPlaceIds.length > 0) {
    await prisma.procedureOrder.updateMany({
      where: { id: { in: needPlaceIds } },
      data: {
        status: "PROPOSED",
        paymentReceiptRef: receiptRef,
        inPackage: false,
      },
    });
  }
  for (const c of chargedMeta) {
    await prisma.procedureOrder.update({
      where: { id: c.orderId },
      data: { amountNet: c.amount },
    });
  }

  let placed = keepScheduledIds.length;
  if (needPlaceIds.length > 0) {
    try {
      if (openNeedPin.length > 0) {
        const { pinOpenAttendanceOrders } = await import(
          "@/domain/procedure/open-attendance"
        );
        placed += (
          await pinOpenAttendanceOrders(openNeedPin, { confirmedByUserId: actorUserId })
        ).placed;
      }
      if (fixedLoose.length > 0) {
        placed += (
          await placeConfirmedProcedures(fixedLoose, { confirmedByUserId: actorUserId })
        ).placed;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "schedule failed";
      for (const line of accepted) {
        if (needPlaceIds.includes(line.id)) line.reason = reason;
      }
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
  if (order.resourceId) {
    await prisma.procedureOrder.update({
      where: { id: order.id },
      data: { status: "SCHEDULED", inPackage: false },
    });
  } else if (
    order.schedulingMode === "OPEN" &&
    plansExtraBeforePay((await getClinicSettings()).extraProcedureRoute)
  ) {
    // PLAN_BEFORE_PAY already day-bucketed this OPEN row — keep the pin.
    await prisma.procedureOrder.update({
      where: { id: order.id },
      data: { status: "SCHEDULED", inPackage: false },
    });
  } else {
    // Money is confirmed at hotel first. Placement may wait on anamnesis / care team —
    // do not reject settlement-confirmed for those gates (hotel already PAID).
    await prisma.procedureOrder.update({
      where: { id: order.id },
      data: { status: "PROPOSED", inPackage: false },
    });
    try {
      if (order.schedulingMode === "OPEN") {
        const { pinOpenAttendanceOrders } = await import(
          "@/domain/procedure/open-attendance"
        );
        await pinOpenAttendanceOrders([order.id], {});
      } else {
        await placeConfirmedProcedures([order.id], {});
      }
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      if (code === ANAMNESIS_REQUIRED || code === CARE_TEAM_REQUIRED) {
        console.warn("Walk-in settlement: left PROPOSED until clinical gates pass", {
          orderId: order.id,
          code,
        });
      } else {
        throw err;
      }
    }
  }
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
): Promise<{ stornoPrintPath: string }> {
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
  const { extraStornoPrintPath } = await import("@/domain/procedure/extra-ticket");
  return { stornoPrintPath: extraStornoPrintPath(orderId, order.organizationId) };
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

/**
 * Close unpaid extras without a folio charge. Seated rows release the cabin.
 * Day-end may pass today's seated, overdue scheduledAt, or unseated created
 * before today. Checkout passes every remaining unpaid row on the episode.
 */
export async function closeUnpaidExtras(
  where: Prisma.ProcedureOrderWhereInput,
  reason: string,
): Promise<number> {
  const rows = await prisma.procedureOrder.findMany({
    where: { ...where, status: "PENDING_PAY", inPackage: false },
    select: { id: true },
  });
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => row.id);
  await releaseProcedureOccupancy(ids);
  await prisma.procedureOrder.updateMany({
    where: { id: { in: ids }, status: "PENDING_PAY" },
    data: {
      status: "UNPAID_MISSED",
      resourceId: null,
      cancelledAt: new Date(),
      cancelReason: reason,
    },
  });
  return ids.length;
}

/** Reception drops one unpaid row. It does not return to the pay basket. */
export async function cancelUnpaidExtra(orderId: string, actorUserId: string): Promise<void> {
  const order = await prisma.procedureOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new PackageAssignError("Not found", "NOT_FOUND", 404);
  if (order.status !== "PENDING_PAY" || order.inPackage) {
    throw new PackageAssignError("Only an unpaid extra can be cancelled here", "INVALID_STATUS", 400);
  }
  await releaseProcedureOccupancy([order.id]);
  await prisma.procedureOrder.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      resourceId: null,
      cancelledAt: new Date(),
      cancelledByUserId: actorUserId,
      cancelReason: "reception_unpaid_cancel",
    },
  });
  await recordClinicAudit(
    { userId: actorUserId },
    "ProcedureOrder",
    order.id,
    "EXTRA_UNPAID_CANCEL",
    { before: { status: "PENDING_PAY" }, after: { status: "CANCELLED" } },
  );
}

/** Checkout: remaining unpaid extras become missed-unpaid and free their cabins. */
export async function purgePendingExtrasForEpisode(episodeId: string): Promise<number> {
  return closeUnpaidExtras({ clinicalEpisodeId: episodeId }, "unpaid_checkout");
}
