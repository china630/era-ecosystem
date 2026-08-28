import { prisma } from "@/lib/prisma";
import { resolveSatelliteTenantOrgId } from "@era/satellite-kit";
import type { ElektrawebOutboxSource, ElektrawebOutboxStatus } from "@prisma/client";
import {
  getElektrawebBridgePolicy,
  getPolicySpaCurrencyId,
  getPolicySpaDepId,
  getPolicyWalkinFolio,
  isPolicyWriteEnabled,
  requirePolicyHotelId,
} from "@/lib/integration/elektraweb-bridge/config";
import { lookupSpaProduct } from "@/lib/integration/elektraweb-bridge/spa-product-map";
import { buildSpaSavePayload } from "@/lib/integration/elektraweb-bridge/spa-save-payload";

export class ElektrawebOutboxError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ElektrawebOutboxError";
    this.status = status;
  }
}

export type EnqueueOutboxInput = {
  organizationId: string;
  source: ElektrawebOutboxSource;
  idempotencyKey: string;
  patientOrigin: "IN_HOUSE" | "WALK_IN";
  reservationId?: string | null;
  procedureCode: string;
  procedureName: string;
  amount: number;
  description: string;
};

async function requireOrgPolicy(organizationId: string) {
  const policy = await getElektrawebBridgePolicy(organizationId);
  if (!isPolicyWriteEnabled(policy) || !policy) {
    throw new ElektrawebOutboxError(
      "Elektraweb bridge write is disabled for this organization",
      503,
    );
  }
  return policy;
}

export async function enqueueElektrawebOutbox(input: EnqueueOutboxInput) {
  const orgId = input.organizationId;
  const policy = await requireOrgPolicy(orgId);

  const existing = await prisma.elektrawebFolioOutbox.findUnique({
    where: {
      organizationId_idempotencyKey: { organizationId: orgId, idempotencyKey: input.idempotencyKey },
    },
  });
  if (existing) return existing;

  const product = lookupSpaProduct({
    procedureCode: input.procedureCode,
    procedureName: input.procedureName,
  });
  if (!product) {
    throw new ElektrawebOutboxError(
      `Unknown SPA product for ${input.procedureCode} / ${input.procedureName}`,
      422,
    );
  }

  let elektrawebResNameId: string;
  let elektrawebResId: string | null = null;
  let reservationId: string | null = input.reservationId ?? null;

  if (input.patientOrigin === "WALK_IN") {
    const house = getPolicyWalkinFolio(policy);
    if (!house) {
      throw new ElektrawebOutboxError(
        "Walk-in folio (walkinResId / walkinResNameId) is not configured for this organization",
        503,
      );
    }
    elektrawebResNameId = house.resNameId;
    elektrawebResId = house.resId;
    if (!reservationId) {
      const houseStay = await prisma.reservation.findFirst({
        where: { organizationId: orgId, externalRef: house.resId },
        select: { id: true },
      });
      reservationId = houseStay?.id ?? null;
    }
  } else {
    if (!reservationId) {
      throw new ElektrawebOutboxError("reservationId required for IN_HOUSE extra", 400);
    }
    const stay = await prisma.reservation.findFirst({
      where: { id: reservationId, organizationId: orgId },
      select: { id: true, externalRef: true, elektrawebResNameId: true },
    });
    if (!stay) throw new ElektrawebOutboxError("Reservation not found", 404);
    if (!stay.elektrawebResNameId) {
      throw new ElektrawebOutboxError(
        "Stay is missing Elektraweb RESNAMEID — open the in-house guest in Elektraweb so inbound can stamp it",
        409,
      );
    }
    elektrawebResNameId = stay.elektrawebResNameId;
    elektrawebResId = stay.externalRef;
  }

  const payload = buildSpaSavePayload({
    hotelId: requirePolicyHotelId(policy),
    depId: getPolicySpaDepId(policy),
    currencyId: getPolicySpaCurrencyId(policy),
    resNameId: Number(elektrawebResNameId),
    lines: [
      {
        productId: product.id,
        serviceName: product.name,
        price: input.amount,
        quantity: 1,
      },
    ],
  });

  return prisma.elektrawebFolioOutbox.create({
    data: {
      organizationId: orgId,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      patientOrigin: input.patientOrigin,
      reservationId,
      elektrawebResNameId,
      elektrawebResId,
      elektrawebRevId: String(product.id),
      procedureCode: input.procedureCode,
      procedureName: input.procedureName,
      amount: input.amount,
      description: input.description,
      insertPayload: payload,
      status: "PENDING",
    },
  });
}

export async function claimPendingOutbox(organizationId: string, limit = 5) {
  const policy = await getElektrawebBridgePolicy(organizationId);
  if (!isPolicyWriteEnabled(policy)) return [];
  const staleSending = new Date(Date.now() - 2 * 60 * 1000);
  const pending = await prisma.elektrawebFolioOutbox.findMany({
    where: {
      organizationId,
      OR: [
        { status: "PENDING" },
        { status: "SENDING", updatedAt: { lt: staleSending } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const claimed = [];
  for (const row of pending) {
    const updated = await prisma.elektrawebFolioOutbox.updateMany({
      where: {
        id: row.id,
        organizationId,
        status: { in: ["PENDING", "SENDING"] },
      },
      data: { status: "SENDING" },
    });
    if (updated.count === 1) claimed.push(row);
  }
  return claimed;
}

export async function ackElektrawebOutbox(input: {
  organizationId: string;
  id: string;
  ok: boolean;
  elektrawebLineId?: string | null;
  error?: string | null;
}) {
  const row = await prisma.elektrawebFolioOutbox.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
  });
  if (!row) throw new ElektrawebOutboxError("Outbox row not found", 404);
  if (row.status === "POSTED") return row;

  const status: ElektrawebOutboxStatus = input.ok ? "POSTED" : "FAILED";
  return prisma.elektrawebFolioOutbox.update({
    where: { id: row.id },
    data: {
      status,
      elektrawebLineId: input.ok ? (input.elektrawebLineId ?? row.elektrawebLineId) : row.elektrawebLineId,
      lastError: input.ok ? null : (input.error ?? "Insert failed"),
      postedAt: input.ok ? new Date() : row.postedAt,
    },
  });
}

export async function countOutboxByStatus(organizationId?: string) {
  const orgId = organizationId ?? resolveSatelliteTenantOrgId();
  if (!orgId) return {};
  const groups = await prisma.elektrawebFolioOutbox.groupBy({
    by: ["status"],
    where: { organizationId: orgId },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const g of groups) counts[g.status] = g._count._all;
  return counts;
}
