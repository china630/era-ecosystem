import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { allocatePatientRefCode } from "@/domain/patient/allocate-patient-ref-code";
import { composeFullName } from "@/domain/patient/patient-ref-code";
import { procedureFitsGuestSex } from "@/domain/procedure/procedure-sex-gate";
import { allocateClinicReceiptNo } from "@/domain/cashier/receipt-seq.service";
import { extraTicketIdForOrder } from "@/domain/procedure/extra-ticket";
import { tryResolveSellableSku } from "@/lib/billing-router";
import { postHotelSettlementPending } from "@/lib/settlement-hub-client";
import { recordClinicAudit, listAuditLogs } from "@/lib/satellite-audit";
import { createLabOrderWithItems } from "@/domain/lab/lab-order-write.service";
import {
  guestPlaceholderName,
  isGuestPlaceholder,
  nextPartyStatus,
} from "@/domain/sanatorium/walk-in-party";

export class WalkInPartyError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type Actor = {
  userId?: string | null;
  actorName?: string | null;
  request?: Request;
};

type Sex = "MALE" | "FEMALE";

function ymdToDate(ymd: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new WalkInPartyError("Visit date is required", "VISIT_DATE");
  }
  return new Date(`${ymd}T00:00:00.000Z`);
}

function dateToYmd(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function audit(
  actor: Actor,
  partyId: string,
  action: string,
  summary: string,
  fields: Array<{ key: string; from: string | null; to: string | null }> = [],
) {
  await recordClinicAudit(
    { userId: actor.userId, request: actor.request },
    "WalkInParty",
    partyId,
    action,
    { summary, actorName: actor.actorName ?? null, fields },
  );
}

async function loadParty(id: string) {
  const party = await prisma.walkInParty.findFirst({
    where: { id, organizationId: requestOrganizationId() },
    include: {
      guests: {
        orderBy: { sortOrder: "asc" },
        include: {
          patientRef: true,
        },
      },
    },
  });
  if (!party) throw new WalkInPartyError("Group not found", "NOT_FOUND", 404);
  return party;
}

async function unpaidCount(episodeIds: string[]): Promise<number> {
  if (episodeIds.length === 0) return 0;
  const [procedures, labs, visits] = await Promise.all([
    prisma.procedureOrder.count({
      where: { clinicalEpisodeId: { in: episodeIds }, status: "PENDING_PAY", inPackage: false },
    }),
    prisma.labOrder.count({
      where: {
        clinicalEpisodeId: { in: episodeIds },
        settledAt: null,
        status: { not: "CANCELLED" },
        amountNet: { gt: 0 },
      },
    }),
    prisma.visit.count({
      where: {
        clinicalEpisodeId: { in: episodeIds },
        settledAt: null,
        status: { not: "CANCELLED" },
        amountNet: { gt: 0 },
      },
    }),
  ]);
  return procedures + labs + visits;
}

async function refreshStatus(partyId: string, receiptRef: string | null, episodeIds: string[]) {
  const status = nextPartyStatus({
    receiptRef,
    unpaidCount: await unpaidCount(episodeIds),
  });
  await prisma.walkInParty.update({ where: { id: partyId }, data: { status } });
  return status;
}

async function listPrice(serviceCode: string): Promise<number> {
  const { applyPriceMissingFallback, resolveEntitlementCharge } = await import(
    "@/domain/sanatorium/entitlement-charge.service"
  );
  const charge = applyPriceMissingFallback(
    await resolveEntitlementCharge({ patientOrigin: "WALK_IN", serviceCode }),
    { serviceCode, where: "walk-in-party" },
  );
  return charge.amountNet;
}

export async function listWalkInParties() {
  const rows = await prisma.walkInParty.findMany({
    where: { organizationId: requestOrganizationId() },
    orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
    include: {
      guests: { select: { clinicalEpisodeId: true } },
      _count: { select: { guests: true } },
    },
  });
  const listed = [];
  for (const row of rows) {
    const status = await refreshStatus(
      row.id,
      row.receiptRef,
      row.guests.map((guest) => guest.clinicalEpisodeId),
    );
    listed.push({
      id: row.id,
      name: row.name,
      visitDate: dateToYmd(row.visitDate),
      status,
      receiptRef: row.receiptRef,
      guestCount: row._count.guests,
    });
  }
  return listed;
}

export async function createWalkInParty(
  input: { name: string; visitDate: string },
  actor: Actor,
) {
  const name = input.name.trim();
  if (!name) throw new WalkInPartyError("Group name is required", "NAME");
  const party = await prisma.walkInParty.create({
    data: {
      organizationId: requestOrganizationId(),
      name,
      visitDate: ymdToDate(input.visitDate),
      createdByUserId: actor.userId ?? null,
    },
  });
  await audit(actor, party.id, "PARTY_CREATE", name);
  return getWalkInParty(party.id);
}

async function sellableCode(code: string): Promise<string> {
  const diagnostic = await prisma.diagnosticService.findFirst({
    where: { active: true, OR: [{ code }, { serviceCode: code }] },
    select: { serviceCode: true },
  });
  return diagnostic?.serviceCode?.trim() || code;
}

export async function getWalkInParty(id: string) {
  const party = await loadParty(id);
  const episodeIds = party.guests.map((guest) => guest.clinicalEpisodeId);
  const status = await refreshStatus(party.id, party.receiptRef, episodeIds);
  const [procedures, labs, visits] = await Promise.all([
    episodeIds.length
      ? prisma.procedureOrder.findMany({
          where: { clinicalEpisodeId: { in: episodeIds }, inPackage: false },
          orderBy: { createdAt: "asc" },
          include: { prescribedByPractitioner: { select: { fullName: true } } },
        })
      : [],
    episodeIds.length
      ? prisma.labOrder.findMany({
          where: { clinicalEpisodeId: { in: episodeIds } },
          orderBy: { createdAt: "asc" },
          include: { items: { select: { serviceCode: true }, orderBy: { sortOrder: "asc" } } },
        })
      : [],
    episodeIds.length
      ? prisma.visit.findMany({
          where: { clinicalEpisodeId: { in: episodeIds } },
          orderBy: { createdAt: "asc" },
          include: {
            practitioner: { select: { fullName: true } },
            serviceLines: true,
          },
        })
      : [],
  ]);
  const labCodes = [
    ...new Set(labs.flatMap((row) => [row.testCode, ...row.items.map((item) => item.serviceCode)])),
  ];
  const catalogNames = labCodes.length
    ? await prisma.serviceCatalogCache.findMany({
        where: { code: { in: labCodes } },
        select: { code: true, description: true },
      })
    : [];
  const labName = new Map(catalogNames.map((row) => [row.code, row.description]));

  const guests = party.guests.map((guest) => {
    const placeholder = isGuestPlaceholder(guest.patientRef.fullName, guest.sortOrder);
    return {
      id: guest.id,
      sortOrder: guest.sortOrder,
      label: guestPlaceholderName(guest.sortOrder),
      patientRefId: guest.patientRefId,
      episodeId: guest.clinicalEpisodeId,
      firstName: guest.patientRef.firstName,
      lastName: guest.patientRef.lastName,
      fullName: placeholder ? "" : guest.patientRef.fullName,
      placeholder,
      sex: guest.patientRef.sex,
      nationality: guest.patientRef.nationality ?? "",
      procedures: procedures
        .filter((row) => row.clinicalEpisodeId === guest.clinicalEpisodeId)
        .map((row) => ({
          id: row.id,
          kind: "procedure" as const,
          code: row.procedureCode,
          name: row.procedureName,
          amount: Number(row.amountNet),
          status: row.status,
          sent: Boolean(row.paymentReceiptRef),
          doctorName: row.prescribedByPractitioner?.fullName ?? "",
        })),
      labs: labs
        .filter((row) => row.clinicalEpisodeId === guest.clinicalEpisodeId)
        .map((row) => ({
          id: row.id,
          kind: "lab" as const,
          code: row.items[0]?.serviceCode || row.testCode,
          name: labName.get(row.items[0]?.serviceCode || row.testCode) || row.testCode,
          amount: Number(row.amountNet),
          status: row.settledAt ? "PAID" : row.status,
          sent: Boolean(row.settlementPendingId),
        })),
      visits: visits
        .filter((row) => row.clinicalEpisodeId === guest.clinicalEpisodeId)
        .map((row) => ({
          id: row.id,
          kind: "visit" as const,
          code: row.serviceLines[0]?.serviceCode ?? "",
          name: row.serviceLines[0]?.description || row.practitioner.fullName,
          amount: Number(row.amountNet),
          status: row.settledAt ? "PAID" : row.status,
          sent: Boolean(row.settlementPendingId),
          doctorName: row.practitioner.fullName,
        })),
    };
  });

  const total = guests.reduce(
    (sum, guest) =>
      sum +
      guest.procedures.reduce((inner, row) => inner + row.amount, 0) +
      guest.labs.reduce((inner, row) => inner + row.amount, 0) +
      guest.visits.reduce((inner, row) => inner + row.amount, 0),
    0,
  );

  return {
    id: party.id,
    name: party.name,
    visitDate: dateToYmd(party.visitDate),
    status,
    receiptRef: party.receiptRef,
    total,
    guests,
  };
}

async function openWalkInEpisode(patientRefId: string, organizationId: string) {
  const open = await prisma.clinicalEpisode.findFirst({
    where: { patientRefId, status: "OPEN" },
  });
  if (open?.patientOrigin === "IN_HOUSE") {
    throw new WalkInPartyError(
      "This guest already has an open in-house course",
      "IN_HOUSE_OPEN",
      409,
    );
  }
  if (open) return open;
  return prisma.clinicalEpisode.create({
    data: {
      patientRefId,
      organizationId,
      patientOrigin: "WALK_IN",
      status: "OPEN",
    },
  });
}

export async function addWalkInPartyGuest(
  partyId: string,
  input: {
    sex: Sex;
    nationality: string;
    firstName?: string;
    lastName?: string;
    patientRefId?: string | null;
  },
  actor: Actor,
) {
  const party = await loadParty(partyId);
  const nationality = input.nationality.trim();
  if (!nationality) throw new WalkInPartyError("Country is required", "COUNTRY");
  const orgId = requestOrganizationId();
  const sortOrder = (party.guests.at(-1)?.sortOrder ?? 0) + 1;
  const firstName = input.firstName?.trim() ?? "";
  const lastName = input.lastName?.trim() ?? "";
  const fullName =
    firstName || lastName
      ? composeFullName({ firstName: firstName || guestPlaceholderName(sortOrder), lastName })
      : guestPlaceholderName(sortOrder);

  let patientId = input.patientRefId?.trim() || "";
  if (patientId) {
    const existing = await prisma.patientRef.findFirst({
      where: { id: patientId, organizationId: orgId },
    });
    if (!existing) throw new WalkInPartyError("Patient not found", "NOT_FOUND", 404);
    await prisma.patientRef.update({
      where: { id: existing.id },
      data: {
        sex: input.sex,
        nationality,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(firstName || lastName ? { fullName } : {}),
      },
    });
  } else {
    const created = await prisma.$transaction(async (tx) => {
      const refCode = await allocatePatientRefCode(tx, orgId);
      return tx.patientRef.create({
        data: {
          organizationId: orgId,
          refCode,
          firstName,
          lastName,
          fullName,
          sex: input.sex,
          nationality,
        },
      });
    });
    patientId = created.id;
  }

  const episode = await openWalkInEpisode(patientId, orgId);
  await prisma.walkInPartyGuest.create({
    data: {
      organizationId: orgId,
      partyId,
      sortOrder,
      patientRefId: patientId,
      clinicalEpisodeId: episode.id,
    },
  });
  await audit(actor, partyId, "GUEST_ADD", fullName, [
    { key: "sex", from: null, to: input.sex },
    { key: "nationality", from: null, to: nationality },
  ]);
  return getWalkInParty(partyId);
}

export async function updateWalkInPartyGuest(
  partyId: string,
  guestId: string,
  input: { sex: Sex; nationality: string; firstName?: string; lastName?: string },
  actor: Actor,
) {
  const party = await loadParty(partyId);
  const guest = party.guests.find((row) => row.id === guestId);
  if (!guest) throw new WalkInPartyError("Guest not found", "NOT_FOUND", 404);
  const nationality = input.nationality.trim();
  if (!nationality) throw new WalkInPartyError("Country is required", "COUNTRY");
  const firstName = input.firstName?.trim() ?? "";
  const lastName = input.lastName?.trim() ?? "";
  const fullName =
    firstName || lastName
      ? composeFullName({ firstName: firstName || guestPlaceholderName(guest.sortOrder), lastName })
      : guestPlaceholderName(guest.sortOrder);
  const before = guest.patientRef.fullName;
  await prisma.patientRef.update({
    where: { id: guest.patientRefId },
    data: { firstName, lastName, fullName, sex: input.sex, nationality },
  });
  await audit(actor, partyId, "GUEST_UPDATE", fullName, [
    { key: "name", from: before, to: fullName },
    { key: "sex", from: guest.patientRef.sex, to: input.sex },
    { key: "nationality", from: guest.patientRef.nationality, to: nationality },
  ]);
  return getWalkInParty(partyId);
}

export async function removeWalkInPartyGuest(partyId: string, guestId: string, actor: Actor) {
  const party = await loadParty(partyId);
  const guest = party.guests.find((row) => row.id === guestId);
  if (!guest) throw new WalkInPartyError("Guest not found", "NOT_FOUND", 404);
  const episodeId = guest.clinicalEpisodeId;
  const [sentProcedure, sentLab, sentVisit] = await Promise.all([
    prisma.procedureOrder.count({
      where: { clinicalEpisodeId: episodeId, paymentReceiptRef: { not: null } },
    }),
    prisma.labOrder.count({
      where: { clinicalEpisodeId: episodeId, settlementPendingId: { not: null } },
    }),
    prisma.visit.count({
      where: { clinicalEpisodeId: episodeId, settlementPendingId: { not: null } },
    }),
  ]);
  if (sentProcedure + sentLab + sentVisit > 0) {
    throw new WalkInPartyError("Guest already sent to the cashier", "ALREADY_SENT", 409);
  }
  await prisma.procedureOrder.deleteMany({
    where: { clinicalEpisodeId: episodeId, status: "PENDING_PAY", inPackage: false },
  });
  await prisma.labOrder.updateMany({
    where: { clinicalEpisodeId: episodeId, settledAt: null, settlementPendingId: null },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Removed from walk-in group" },
  });
  await prisma.visit.updateMany({
    where: { clinicalEpisodeId: episodeId, settledAt: null, settlementPendingId: null },
    data: { status: "CANCELLED" },
  });
  await prisma.walkInPartyGuest.delete({ where: { id: guestId } });
  await audit(actor, partyId, "GUEST_REMOVE", guest.patientRef.fullName);
  return getWalkInParty(partyId);
}

export async function addWalkInPartyLine(
  partyId: string,
  guestId: string,
  input: {
    kind: "procedure" | "lab" | "visit";
    code: string;
    qty?: number;
    practitionerId?: string | null;
  },
  actor: Actor,
) {
  const party = await loadParty(partyId);
  const guest = party.guests.find((row) => row.id === guestId);
  if (!guest) throw new WalkInPartyError("Guest not found", "NOT_FOUND", 404);
  const code = input.code.trim();
  if (!code) throw new WalkInPartyError("Service is required", "CODE");
  const orgId = requestOrganizationId();
  const qty = input.kind === "procedure" ? Math.min(20, Math.max(1, input.qty ?? 1)) : 1;

  if (input.kind === "procedure") {
    const practitionerId = input.practitionerId?.trim() || "";
    if (!practitionerId) throw new WalkInPartyError("Doctor is required", "DOCTOR");
    const practitioner = await prisma.practitioner.findFirst({
      where: { id: practitionerId, active: true },
    });
    if (!practitioner) throw new WalkInPartyError("Doctor not found", "NOT_FOUND", 404);
    if (!(await procedureFitsGuestSex(code, guest.patientRef.sex))) {
      throw new WalkInPartyError("Cabin sex does not match the guest", "CABIN_SEX", 409);
    }
    const procedureType = await prisma.procedureType.findFirst({ where: { code } });
    if (!procedureType) throw new WalkInPartyError("Unknown procedure", "UNKNOWN_TYPE");
    const unitPrice = await listPrice(code);
    if (!(unitPrice > 0)) throw new WalkInPartyError("Procedure has no price", "NO_PRICE");
    const existing = await prisma.procedureOrder.count({
      where: { clinicalEpisodeId: guest.clinicalEpisodeId },
    });
    const now = new Date();
    for (let i = 0; i < qty; i += 1) {
      const scheduledAt = new Date(now.getTime() + (existing + i) * 60_000);
      await prisma.procedureOrder.create({
        data: {
          organizationId: orgId,
          patientRefId: guest.patientRefId,
          clinicalEpisodeId: guest.clinicalEpisodeId,
          procedureTypeId: procedureType.id,
          procedureCode: code,
          procedureName: procedureType.name,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + (procedureType.durationMin ?? 30) * 60_000),
          sequenceIndex: existing + i,
          status: "PENDING_PAY",
          patientOrigin: "WALK_IN",
          amountNet: unitPrice,
          bonusEligible: true,
          inPackage: false,
          prescribedByPractitionerId: practitioner.id,
        },
      });
    }
    await audit(actor, partyId, "LINE_ADD", `${guest.patientRef.fullName}: ${code} ×${qty}`);
  } else if (input.kind === "lab") {
    const priceCode = await sellableCode(code);
    const unitPrice = await listPrice(priceCode);
    if (!(unitPrice > 0)) throw new WalkInPartyError("Lab has no price", "NO_PRICE");
    const order = await createLabOrderWithItems({
      patientRefId: guest.patientRefId,
      clinicalEpisodeId: guest.clinicalEpisodeId,
      codes: [priceCode],
      patientOrigin: "WALK_IN",
      amountNet: unitPrice,
      amountsByCode: { [priceCode]: unitPrice },
    });
    await audit(actor, partyId, "LINE_ADD", `${guest.patientRef.fullName}: ${priceCode}`);
    void order;
  } else {
    const practitionerId = input.practitionerId?.trim() || "";
    if (!practitionerId) throw new WalkInPartyError("Doctor is required", "DOCTOR");
    const practitioner = await prisma.practitioner.findFirst({
      where: { id: practitionerId, active: true },
    });
    if (!practitioner) throw new WalkInPartyError("Doctor not found", "NOT_FOUND", 404);
    const priceCode = await sellableCode(code);
    const unitPrice = await listPrice(priceCode);
    if (!(unitPrice > 0)) throw new WalkInPartyError("Visit has no price", "NO_PRICE");
    const catalog = await prisma.serviceCatalogCache.findFirst({ where: { code: priceCode } });
    await prisma.visit.create({
      data: {
        organizationId: orgId,
        patientRefId: guest.patientRefId,
        practitionerId,
        clinicalEpisodeId: guest.clinicalEpisodeId,
        status: "IN_PROGRESS",
        patientOrigin: "WALK_IN",
        billingTarget: "SETTLEMENT_HUB",
        amountNet: unitPrice,
        serviceLines: {
          create: {
            organizationId: orgId,
            serviceCode: priceCode,
            description: catalog?.description ?? priceCode,
            amount: unitPrice,
            inPackage: false,
          },
        },
      },
    });
    await audit(
      actor,
      partyId,
      "LINE_ADD",
      `${guest.patientRef.fullName}: ${priceCode} · ${practitioner.fullName}`,
    );
  }

  const episodeIds = party.guests.map((row) => row.clinicalEpisodeId);
  await refreshStatus(partyId, party.receiptRef, episodeIds);
  return getWalkInParty(partyId);
}

export async function removeWalkInPartyLine(
  partyId: string,
  guestId: string,
  lineId: string,
  kind: "procedure" | "lab" | "visit",
  actor: Actor,
) {
  const party = await loadParty(partyId);
  const guest = party.guests.find((row) => row.id === guestId);
  if (!guest) throw new WalkInPartyError("Guest not found", "NOT_FOUND", 404);
  if (kind === "procedure") {
    const order = await prisma.procedureOrder.findFirst({
      where: { id: lineId, clinicalEpisodeId: guest.clinicalEpisodeId },
    });
    if (!order || order.status !== "PENDING_PAY" || order.paymentReceiptRef) {
      throw new WalkInPartyError("Only an unsent procedure can be removed", "ALREADY_SENT", 409);
    }
    await prisma.procedureOrder.delete({ where: { id: order.id } });
  } else if (kind === "lab") {
    const order = await prisma.labOrder.findFirst({
      where: { id: lineId, clinicalEpisodeId: guest.clinicalEpisodeId },
    });
    if (!order || order.settlementPendingId || order.settledAt) {
      throw new WalkInPartyError("Only an unsent lab can be removed", "ALREADY_SENT", 409);
    }
    await prisma.labOrder.update({
      where: { id: order.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Removed from walk-in group" },
    });
  } else {
    const visit = await prisma.visit.findFirst({
      where: { id: lineId, clinicalEpisodeId: guest.clinicalEpisodeId },
    });
    if (!visit || visit.settlementPendingId || visit.settledAt) {
      throw new WalkInPartyError("Only an unsent visit can be removed", "ALREADY_SENT", 409);
    }
    await prisma.visit.update({ where: { id: visit.id }, data: { status: "CANCELLED" } });
  }
  await audit(actor, partyId, "LINE_REMOVE", `${guest.patientRef.fullName}: ${kind}`);
  return getWalkInParty(partyId);
}

type CashierLine = {
  sourceRef: string;
  idempotencyKey: string;
  amount: number;
  code: string;
  qty: number;
  description: string;
  mark: () => Promise<void>;
};

export async function sendWalkInPartyToCashier(partyId: string, actor: Actor) {
  const party = await loadParty(partyId);
  const episodeIds = party.guests.map((guest) => guest.clinicalEpisodeId);
  if (episodeIds.length === 0) {
    throw new WalkInPartyError("Add a guest before the cashier", "EMPTY", 400);
  }
  const guestByEpisode = new Map(party.guests.map((guest) => [guest.clinicalEpisodeId, guest]));
  const [procedures, labs, visits] = await Promise.all([
    prisma.procedureOrder.findMany({
      where: {
        clinicalEpisodeId: { in: episodeIds },
        status: "PENDING_PAY",
        inPackage: false,
        paymentReceiptRef: null,
      },
    }),
    prisma.labOrder.findMany({
      where: {
        clinicalEpisodeId: { in: episodeIds },
        settlementPendingId: null,
        settledAt: null,
        status: { not: "CANCELLED" },
        amountNet: { gt: 0 },
      },
      include: { items: { select: { serviceCode: true }, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.visit.findMany({
      where: {
        clinicalEpisodeId: { in: episodeIds },
        settlementPendingId: null,
        settledAt: null,
        status: { not: "CANCELLED" },
        amountNet: { gt: 0 },
      },
      include: { serviceLines: true },
    }),
  ]);

  const receipt = party.receiptRef ?? (await allocateClinicReceiptNo(requestOrganizationId()));
  const lines: CashierLine[] = [];
  for (const order of procedures) {
    const guest = guestByEpisode.get(order.clinicalEpisodeId ?? "");
    const name = guest?.patientRef.fullName ?? order.procedureName;
    lines.push({
      sourceRef: order.id,
      idempotencyKey: extraTicketIdForOrder(order.id),
      amount: Number(order.amountNet),
      code: order.procedureCode,
      qty: order.quantity ?? 1,
      description: `${name} · ${order.procedureName} · ${receipt}`,
      mark: async () => {
        await prisma.procedureOrder.update({
          where: { id: order.id },
          data: { paymentReceiptRef: receipt },
        });
      },
    });
  }
  for (const order of labs) {
    const guest = guestByEpisode.get(order.clinicalEpisodeId ?? "");
    const code = await sellableCode(order.items[0]?.serviceCode || order.testCode);
    lines.push({
      sourceRef: `lab:${order.id}`,
      idempotencyKey: `lab-ticket-${order.id}`,
      amount: Number(order.amountNet),
      code,
      qty: 1,
      description: `${guest?.patientRef.fullName ?? "Guest"} · ${code} · ${receipt}`,
      mark: async () => {
        await prisma.labOrder.update({
          where: { id: order.id },
          data: { settlementPendingId: receipt },
        });
      },
    });
  }
  for (const visit of visits) {
    const guest = guestByEpisode.get(visit.clinicalEpisodeId ?? "");
    const code = visit.serviceLines[0]?.serviceCode ?? "VISIT";
    lines.push({
      sourceRef: visit.id,
      idempotencyKey: `visit-ticket-${visit.id}`,
      amount: Number(visit.amountNet),
      code,
      qty: 1,
      description: `${guest?.patientRef.fullName ?? "Guest"} · ${code} · ${receipt}`,
      mark: async () => {
        await prisma.visit.update({
          where: { id: visit.id },
          data: { settlementPendingId: receipt },
        });
      },
    });
  }

  const priced = lines.filter((line) => line.amount > 0);
  if (priced.length === 0) {
    throw new WalkInPartyError("Nothing priced to send", "EMPTY", 400);
  }

  const rejected: Array<{ code: string; reason: string }> = [];
  let sent = 0;
  for (const line of priced) {
    const sku = await tryResolveSellableSku(line.code);
    if (!sku) {
      rejected.push({ code: line.code, reason: "no SKU" });
      continue;
    }
    try {
      await postHotelSettlementPending({
        sourceRef: line.sourceRef,
        amount: line.amount,
        description: line.description,
        payerLabel: party.name,
        idempotencyKey: line.idempotencyKey,
        sku,
        qty: line.qty,
        basketRef: receipt,
      });
      await line.mark();
      sent += 1;
    } catch (err) {
      rejected.push({
        code: line.code,
        reason: err instanceof Error ? err.message : "hotel rejected the line",
      });
    }
  }
  if (sent === 0) {
    throw new WalkInPartyError(rejected[0]?.reason ?? "Cashier rejected the group", "CASHIER", 409);
  }
  await prisma.walkInParty.update({
    where: { id: partyId },
    data: { receiptRef: receipt },
  });
  await refreshStatus(partyId, receipt, episodeIds);
  await audit(actor, partyId, "SENT_TO_CASHIER", `${party.name} · ${receipt}`, [
    { key: "receipt", from: null, to: receipt },
    { key: "sent", from: null, to: String(sent) },
  ]);
  return { ...(await getWalkInParty(partyId)), sent, rejected };
}

export async function listWalkInPartyJournal(partyId: string) {
  await loadParty(partyId);
  const rows = await listAuditLogs("WalkInParty", partyId, 200);
  return rows.map((row) => {
    const changes = JSON.parse(row.changesJson || "{}") as {
      summary?: string;
      actorName?: string | null;
      fields?: Array<{ key: string; from: string | null; to: string | null }>;
    };
    return {
      id: row.id,
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      actor: changes.actorName || row.userId,
      summary: changes.summary ?? row.action,
      fields: changes.fields ?? [],
    };
  });
}

/** Hotel cashier confirmed one line of a walk-in party. */
export async function recordWalkInPartySettlement(sourceRef: string, actorName: string) {
  const labId = sourceRef.startsWith("lab:") ? sourceRef.slice(4) : "";
  const episodeId = labId
    ? (await prisma.labOrder.findUnique({ where: { id: labId }, select: { clinicalEpisodeId: true } }))
        ?.clinicalEpisodeId
    : (
        await prisma.procedureOrder.findUnique({
          where: { id: sourceRef },
          select: { clinicalEpisodeId: true },
        })
      )?.clinicalEpisodeId ??
      (
        await prisma.visit.findUnique({
          where: { id: sourceRef },
          select: { clinicalEpisodeId: true },
        })
      )?.clinicalEpisodeId;
  if (!episodeId) return;
  const guest = await prisma.walkInPartyGuest.findFirst({
    where: { clinicalEpisodeId: episodeId },
    include: { party: { include: { guests: true } } },
  });
  if (!guest) return;
  await recordClinicAudit(
    { userId: null },
    "WalkInParty",
    guest.partyId,
    "HOTEL_PAID",
    { summary: sourceRef, actorName, fields: [] },
  );
  await refreshStatus(
    guest.partyId,
    guest.party.receiptRef,
    guest.party.guests.map((row) => row.clinicalEpisodeId),
  );
}
