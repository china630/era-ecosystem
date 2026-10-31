/**
 * Paid labs, imaging, and visits from the episode diagnostics tab.
 * Prescribe creates LabOrder / Visit with amountNet > 0 and settledAt null.
 * Lab journal hides them until Pay confirms (folio or settlement hub).
 */
import { clinicLabTicketRef, clinicVisitTicketRef } from "@era/satellite-kit/integration/folio-charge-ref";
import { enterSatelliteTenant } from "@era/satellite-kit";
import { createLabOrderWithItems } from "@/domain/lab/lab-order-write.service";
import { LAB_ALREADY_OPEN } from "@/domain/lab/lab-order-conflict.service";
import { allocateClinicReceiptNo } from "@/domain/cashier/receipt-seq.service";
import { postProcedureFolioCharge } from "@/domain/procedure/procedure-charge.service";
import {
  getClinicHotelOrganizationId,
  resolveClinicCutoverOrgId,
} from "@/domain/physio/clinic-cutover.service";
import { revenueCodeForServiceLine, tryResolveSellableSku } from "@/lib/billing-router";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { resolveExtraPrescriber } from "@/lib/extra-prescriber";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";
import { episodeAnamnesisDenied, ANAMNESIS_REQUIRED } from "@/domain/sanatorium/episode-gates";
import {
  CARE_TEAM_REQUIRED,
  episodeCareTeamDenied,
} from "@/domain/sanatorium/episode-care-team-gates";
import { countEpisodeCareDoctors } from "@/domain/sanatorium/episode-care-team.service";
import { parseBakuDateTime } from "@/lib/baku-day";

export type DiagnosticPrescribeLine = {
  serviceCode: string;
  qty: number;
  note?: string | null;
  /** VISIT only — optional Baku wall time `YYYY-MM-DDTHH:mm`. */
  scheduledAt?: string | null;
};

export type PendingDiagnosticRow = {
  id: string;
  kind: "lab" | "visit";
  serviceCode: string;
  title: string;
  amountNet: number;
  status: string;
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

async function resolvePrescriber(
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

async function catalogTitle(
  service: {
    code: string;
    titleAz: string | null;
    titleRu: string | null;
    titleEn: string | null;
  },
): Promise<string> {
  return (
    service.titleAz?.trim() ||
    service.titleRu?.trim() ||
    service.titleEn?.trim() ||
    service.code
  );
}

async function listPriceOrZero(serviceCode: string): Promise<number> {
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

async function resolveDiagnosticService(code: string, orgId: string) {
  return prisma.diagnosticService.findFirst({
    where: {
      active: true,
      organizationId: orgId,
      OR: [{ code }, { serviceCode: code }],
    },
    select: {
      code: true,
      serviceCode: true,
      kind: true,
      titleAz: true,
      titleRu: true,
      titleEn: true,
    },
  });
}

/**
 * Doctor / reception prescribe paid diagnostics. Labs and imaging become LabOrder
 * rows; visit templates become Visit + VisitServiceLine. Nothing is cabin-seated.
 */
export async function prescribeDiagnosticsExtras(
  episodeId: string,
  lines: DiagnosticPrescribeLine[],
  actorUserId?: string | null,
): Promise<{ labOrderIds: string[]; visitIds: string[] }> {
  const episode = await loadEpisode(episodeId);
  if (!episode.patientRefId) {
    throw new PackageAssignError("Episode has no patient", "NOT_FOUND", 404);
  }
  const orgId = requestOrganizationId();
  const prescribedByPractitionerId = await resolvePrescriber(episodeId, actorUserId);
  const origin = episode.patientOrigin === "WALK_IN" ? "WALK_IN" : "IN_HOUSE";
  const labOrderIds: string[] = [];
  const visitIds: string[] = [];

  for (const line of lines) {
    if (line.qty < 1) continue;
    const service = await resolveDiagnosticService(line.serviceCode, orgId);
    if (!service) {
      throw new PackageAssignError(
        `Unknown diagnostic service ${line.serviceCode}`,
        "UNKNOWN_TYPE",
        400,
      );
    }
    const sellable = service.serviceCode || service.code;
    const unitPrice = await listPriceOrZero(sellable);
    if (!(unitPrice > 0)) {
      throw new PackageAssignError(
        `Lab ${line.serviceCode} has no price`,
        "NO_PRICE",
        400,
      );
    }

    if (service.kind === "visit") {
      const doctorId =
        prescribedByPractitionerId ??
        (
          await prisma.episodeCareDoctor.findFirst({
            where: { episodeId },
            orderBy: { assignedAt: "asc" },
            select: { practitionerId: true },
          })
        )?.practitionerId;
      if (!doctorId) {
        throw new PackageAssignError(
          "A care-team doctor is required to book a visit",
          "NO_CARE_TEAM",
          409,
        );
      }
      for (let i = 0; i < line.qty; i++) {
        let appointmentId: string | undefined;
        const when = line.scheduledAt?.trim();
        if (when) {
          // Date-only (`YYYY-MM-DD`) or missing HH:mm → clinic default 09:00 Baku.
          // UI must not invent `T09:00` in the draft string when time was left blank.
          const [ymdPart, timePartRaw] = when.includes("T")
            ? when.split("T")
            : [when, ""];
          const hmRaw = (timePartRaw ?? "").trim().slice(0, 5);
          const hm = /^\d{2}:\d{2}$/.test(hmRaw) ? hmRaw : "09:00";
          const at = parseBakuDateTime(ymdPart!, hm);
          if (at) {
            const appt = await prisma.appointment.create({
              data: {
                organizationId: orgId,
                patientRefId: episode.patientRefId,
                practitionerId: doctorId,
                scheduledAt: at,
                status: "SCHEDULED",
              },
            });
            appointmentId = appt.id;
          }
        }
        const title = await catalogTitle(service);
        const visit = await prisma.visit.create({
          data: {
            organizationId: orgId,
            patientRefId: episode.patientRefId,
            practitionerId: doctorId,
            clinicalEpisodeId: episodeId,
            appointmentId,
            status: "IN_PROGRESS",
            patientOrigin: origin,
            billingTarget: origin === "WALK_IN" ? "SETTLEMENT_HUB" : "HOTEL_FOLIO",
            amountNet: unitPrice,
            reservationId: episode.reservationId ?? undefined,
            roomNumber: episode.roomNumber ?? undefined,
            serviceLines: {
              create: {
                organizationId: orgId,
                serviceCode: sellable,
                description: title,
                amount: unitPrice,
                inPackage: false,
              },
            },
          },
        });
        visitIds.push(visit.id);
      }
      continue;
    }

    for (let i = 0; i < line.qty; i++) {
      try {
        const order = await createLabOrderWithItems({
          patientRefId: episode.patientRefId,
          clinicalEpisodeId: episodeId,
          codes: [service.code],
          source: "IN_HOUSE",
          fasting: false,
          confirmRepeat: true,
          patientOrigin: origin,
          forcePaid: true,
          amountNet: unitPrice,
          amountsByCode: { [service.code]: unitPrice, [sellable]: unitPrice },
          prescribedByPractitionerId,
          reservationId: episode.reservationId,
          roomNumber: episode.roomNumber,
        });
        labOrderIds.push(order.id);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === LAB_ALREADY_OPEN) {
          throw new PackageAssignError(
            "An open lab order already exists for this study",
            "LAB_ALREADY_OPEN",
            409,
          );
        }
        if (code === "NO_PRICE") {
          throw new PackageAssignError(
            (err as Error).message,
            "NO_PRICE",
            400,
          );
        }
        throw err;
      }
    }
  }

  return { labOrderIds, visitIds };
}

/** Unpaid paid diagnostics on the course (red / amber awaiting-payment list). */
export async function listPendingDiagnostics(
  episodeId: string,
): Promise<PendingDiagnosticRow[]> {
  const [labs, visits] = await Promise.all([
    prisma.labOrder.findMany({
      where: {
        clinicalEpisodeId: episodeId,
        amountNet: { gt: 0 },
        settledAt: null,
        status: { not: "CANCELLED" },
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          include: {
            diagnosticService: {
              select: { titleAz: true, titleRu: true, titleEn: true, code: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.visit.findMany({
      where: {
        clinicalEpisodeId: episodeId,
        amountNet: { gt: 0 },
        settledAt: null,
        status: { not: "CANCELLED" },
      },
      include: {
        serviceLines: { orderBy: { id: "asc" }, take: 1 },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const rows: PendingDiagnosticRow[] = [];
  for (const order of labs) {
    const svc = order.items[0]?.diagnosticService;
    const code = order.items[0]?.serviceCode || order.testCode;
    rows.push({
      id: order.id,
      kind: "lab",
      serviceCode: code,
      title: svc
        ? svc.titleAz?.trim() || svc.titleRu?.trim() || svc.titleEn?.trim() || code
        : code,
      amountNet: Number(order.amountNet),
      status: "AWAITING_PAYMENT",
    });
  }
  for (const visit of visits) {
    const line = visit.serviceLines[0];
    rows.push({
      id: visit.id,
      kind: "visit",
      serviceCode: line?.serviceCode ?? "VISIT",
      title: line?.description || line?.serviceCode || "VISIT",
      amountNet: Number(visit.amountNet),
      status: "AWAITING_PAYMENT",
    });
  }
  return rows;
}

export async function deletePendingDiagnostic(
  kind: "lab" | "visit",
  id: string,
): Promise<void> {
  if (kind === "lab") {
    const order = await prisma.labOrder.findUnique({ where: { id } });
    if (!order) throw new PackageAssignError("Not found", "NOT_FOUND", 404);
    if (Number(order.amountNet) <= 0 || order.settledAt) {
      throw new PackageAssignError(
        "Only unpaid paid labs can be deleted here",
        "INVALID_STATUS",
        400,
      );
    }
    if (order.status !== "ORDERED") {
      throw new PackageAssignError(
        "Only ORDERED unpaid labs can be deleted here",
        "INVALID_STATUS",
        400,
      );
    }
    await prisma.labOrder.delete({ where: { id } });
    return;
  }
  const visit = await prisma.visit.findUnique({ where: { id } });
  if (!visit) throw new PackageAssignError("Not found", "NOT_FOUND", 404);
  if (Number(visit.amountNet) <= 0 || visit.settledAt) {
    throw new PackageAssignError(
      "Only unpaid paid visits can be deleted here",
      "INVALID_STATUS",
      400,
    );
  }
  await prisma.visit.delete({ where: { id } });
}

export type DiagnosticPayLine = { id: string; kind: "lab" | "visit" };

export type DiagnosticBatchLine = { id: string; kind: "lab" | "visit"; name: string; reason?: string };

/**
 * Reception Pay for unpaid diagnostics. In-house posts folio and stamps settledAt.
 * Walk-in posts settlement pending and waits for hotel confirmation.
 */
export async function payDiagnosticsExtras(
  lines: DiagnosticPayLine[],
  actorUserId: string,
  organizationId?: string | null,
): Promise<{
  paymentReceiptRef: string;
  accepted: DiagnosticBatchLine[];
  rejected: DiagnosticBatchLine[];
}> {
  if (!lines.length) {
    throw new PackageAssignError("No diagnostics selected", "INVALID", 400);
  }
  const orgId = resolveClinicCutoverOrgId(organizationId);
  const receipt = await allocateClinicReceiptNo(orgId);
  enterSatelliteTenant({ organizationId: orgId });
  const hotelOrganizationId = await getClinicHotelOrganizationId(orgId);
  const accepted: DiagnosticBatchLine[] = [];
  const rejected: DiagnosticBatchLine[] = [];

  for (const line of lines) {
    if (line.kind === "lab") {
      const order = await prisma.labOrder.findUnique({
        where: { id: line.id },
        include: {
          patientRef: true,
          items: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      });
      const name = order?.items[0]?.serviceCode || order?.testCode || line.id;
      if (!order || Number(order.amountNet) <= 0 || order.settledAt) {
        rejected.push({
          id: line.id,
          kind: "lab",
          name,
          reason: "not awaiting payment",
        });
        continue;
      }
      const amount = Number(order.amountNet);
      const code = order.items[0]?.serviceCode || order.testCode.split(",")[0] || order.testCode;
      const ticketId = clinicLabTicketRef(order.id);
      try {
        if (order.patientOrigin === "IN_HOUSE") {
          if (!order.reservationId) {
            rejected.push({
              id: order.id,
              kind: "lab",
              name,
              reason: "no hotel reservation",
            });
            continue;
          }
          await postProcedureFolioCharge({
            hotelOrganizationId: hotelOrganizationId ?? undefined,
            reservationId: order.reservationId,
            amount,
            description: `${name} · çek ${receipt}`,
            externalTicketId: ticketId,
            procedureCode: code,
            qty: 1,
          });
          await prisma.labOrder.update({
            where: { id: order.id },
            data: {
              settledAt: new Date(),
              paymentReceiptRef: receipt,
            },
          });
          accepted.push({ id: order.id, kind: "lab", name });
        } else {
          const { postHotelSettlementPending } = await import("@/lib/settlement-hub-client");
          const sku = await tryResolveSellableSku(code);
          if (!sku) {
            rejected.push({ id: order.id, kind: "lab", name, reason: "no SKU" });
            continue;
          }
          await postHotelSettlementPending({
            sourceRef: `lab:${order.id}`,
            amount,
            description: `${order.patientRef.fullName} · ${name} · ${receipt}`,
            payerLabel: order.patientRef.fullName,
            idempotencyKey: ticketId,
            sku,
            qty: 1,
            revenueCode: await revenueCodeForServiceLine(code),
          });
          await prisma.labOrder.update({
            where: { id: order.id },
            data: {
              settlementPendingId: receipt,
              paymentReceiptRef: receipt,
            },
          });
          rejected.push({
            id: order.id,
            kind: "lab",
            name,
            reason: "waiting for hotel payment",
          });
        }
      } catch (err) {
        rejected.push({
          id: order.id,
          kind: "lab",
          name,
          reason: err instanceof Error ? err.message : "hotel rejected the line",
        });
      }
      continue;
    }

    const visit = await prisma.visit.findUnique({
      where: { id: line.id },
      include: {
        patientRef: true,
        serviceLines: { orderBy: { id: "asc" }, take: 1 },
      },
    });
    const name = visit?.serviceLines[0]?.description || visit?.serviceLines[0]?.serviceCode || line.id;
    if (!visit || Number(visit.amountNet) <= 0 || visit.settledAt) {
      rejected.push({
        id: line.id,
        kind: "visit",
        name,
        reason: "not awaiting payment",
      });
      continue;
    }
    const amount = Number(visit.amountNet);
    const code = visit.serviceLines[0]?.serviceCode ?? "VISIT";
    const ticketId = clinicVisitTicketRef(visit.id);
    try {
      if (visit.patientOrigin === "IN_HOUSE") {
        if (!visit.reservationId) {
          rejected.push({
            id: visit.id,
            kind: "visit",
            name,
            reason: "no hotel reservation",
          });
          continue;
        }
        await postProcedureFolioCharge({
          hotelOrganizationId: hotelOrganizationId ?? undefined,
          reservationId: visit.reservationId,
          amount,
          description: `${name} · çek ${receipt}`,
          externalTicketId: ticketId,
          procedureCode: code,
          qty: 1,
        });
        await prisma.visit.update({
          where: { id: visit.id },
          data: {
            settledAt: new Date(),
            paymentReceiptRef: receipt,
            billingTarget: "HOTEL_FOLIO",
          },
        });
        accepted.push({ id: visit.id, kind: "visit", name });
      } else {
        const { postHotelSettlementPending } = await import("@/lib/settlement-hub-client");
        const sku = await tryResolveSellableSku(code);
        if (!sku) {
          rejected.push({ id: visit.id, kind: "visit", name, reason: "no SKU" });
          continue;
        }
        await postHotelSettlementPending({
          sourceRef: visit.id,
          amount,
          description: `${visit.patientRef.fullName} · ${name} · ${receipt}`,
          payerLabel: visit.patientRef.fullName,
          idempotencyKey: ticketId,
          sku,
          qty: 1,
          revenueCode: await revenueCodeForServiceLine(code),
        });
        await prisma.visit.update({
          where: { id: visit.id },
          data: {
            settlementPendingId: receipt,
            paymentReceiptRef: receipt,
          },
        });
        rejected.push({
          id: visit.id,
          kind: "visit",
          name,
          reason: "waiting for hotel payment",
        });
      }
    } catch (err) {
      rejected.push({
        id: visit.id,
        kind: "visit",
        name,
        reason: err instanceof Error ? err.message : "hotel rejected the line",
      });
    }
  }

  void actorUserId;
  return { paymentReceiptRef: receipt, accepted, rejected };
}

/**
 * Hotel folio void / storno before sample collection: clear settledAt so the
 * order leaves the lab journal again.
 */
export async function reverseDiagnosticPayment(input: {
  kind: "lab" | "visit";
  id: string;
}): Promise<void> {
  if (input.kind === "lab") {
    const order = await prisma.labOrder.findUnique({ where: { id: input.id } });
    if (!order) throw new PackageAssignError("Not found", "NOT_FOUND", 404);
    if (order.status !== "ORDERED" && order.status !== "CANCELLED") {
      throw new PackageAssignError(
        "Cannot reverse payment after collection",
        "ALREADY_COLLECTED",
        409,
      );
    }
    await prisma.labOrder.update({
      where: { id: order.id },
      data: {
        settledAt: null,
        settlementPendingId: null,
        paymentReceiptRef: null,
      },
    });
    return;
  }
  const visit = await prisma.visit.findUnique({ where: { id: input.id } });
  if (!visit) throw new PackageAssignError("Not found", "NOT_FOUND", 404);
  await prisma.visit.update({
    where: { id: visit.id },
    data: {
      settledAt: null,
      settlementPendingId: null,
      paymentReceiptRef: null,
    },
  });
}
