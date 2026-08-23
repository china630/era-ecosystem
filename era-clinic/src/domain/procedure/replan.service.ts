import { createHash } from "crypto";
import type { ProcedureReplanMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { satelliteOrganizationId } from "@era/satellite-kit";
import { bakuDayRange } from "@/lib/baku-day";
import { getDefaultTenant } from "@/domain/settings/settings.service";
import { placeConfirmedProcedures } from "@/lib/treatment-planner.service";
import { isReplanImmovable } from "@/domain/procedure/replan-guards";
import {
  occupancyFitsGenderWindow,
  resolveGenderSession,
  genderTenantFromPrisma,
} from "@/domain/procedure/gender-session";

const PREVIEW_TTL_MS = 10 * 60 * 1000;
const UNDO_TTL_MS = 20 * 60 * 1000;

export type ReplanPreviewBody = {
  date: string;
  mode: ProcedureReplanMode;
  resourceId?: string | null;
  procedureTypeId?: string | null;
  respectPins?: boolean;
};

type OrderSnap = {
  id: string;
  status: string;
  scheduledAt: string;
  endsAt: string | null;
  resourceId: string | null;
  allocations: Array<{
    role: string;
    resourceId: string | null;
    practitionerId: string | null;
    startsAt: string;
    endsAt: string;
  }>;
};

function scopeHash(input: ReplanPreviewBody): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        date: input.date,
        mode: input.mode,
        resourceId: input.resourceId ?? null,
        procedureTypeId: input.procedureTypeId ?? null,
        respectPins: input.respectPins !== false,
      }),
    )
    .digest("hex");
}

async function loadDayOrders(input: ReplanPreviewBody) {
  const { start, end } = bakuDayRange(input.date);
  return prisma.procedureOrder.findMany({
    where: {
      scheduledAt: { gte: start, lt: end },
      ...(input.resourceId ? { resourceId: input.resourceId } : {}),
      ...(input.procedureTypeId ? { procedureTypeId: input.procedureTypeId } : {}),
    },
    include: {
      patientRef: { select: { sex: true } },
      procedureType: true,
      allocations: true,
    },
  });
}

export async function buildReplanPreview(input: ReplanPreviewBody, actorUserId: string) {
  const tenant = await getDefaultTenant();
  const now = new Date();
  const respectPins = input.respectPins !== false;
  const rows = await loadDayOrders(input);
  const genderTenant = genderTenantFromPrisma(tenant);

  const candidates: typeof rows = [];
  let pinnedSkipped = 0;
  for (const row of rows) {
    if (input.mode === "FILL_HOLES") {
      if (row.status === "PROPOSED") candidates.push(row);
      continue;
    }
    const frozen = isReplanImmovable({
      status: row.status,
      scheduledAt: row.scheduledAt,
      now,
      manuallyAdjusted: row.manuallyAdjusted,
      respectPins,
    });
    if (frozen) {
      if (row.manuallyAdjusted && respectPins && row.status === "SCHEDULED") pinnedSkipped += 1;
      continue;
    }
    if (input.mode === "APPLY_GENDER_WINDOWS") {
      if (!row.procedureType) continue;
      const resolved = resolveGenderSession(genderTenant, row.procedureType);
      if (!resolved.active) continue;
      const fits = occupancyFitsGenderWindow({
        resolved,
        sex: row.patientRef.sex,
        startsAt: row.scheduledAt,
        endsAt: row.endsAt ?? row.scheduledAt,
      });
      if (!fits) candidates.push(row);
      continue;
    }
    if (row.status === "SCHEDULED" || row.status === "PROPOSED") candidates.push(row);
  }

  const payload = {
    candidateIds: candidates.map((c) => c.id),
    counts: {
      candidates: candidates.length,
      pinnedSkipped,
      proposed: candidates.filter((c) => c.status === "PROPOSED").length,
      scheduled: candidates.filter((c) => c.status === "SCHEDULED").length,
    },
    sample: candidates.slice(0, 12).map((c) => ({
      orderId: c.id,
      code: c.procedureCode,
      from: c.scheduledAt.toISOString(),
      resourceId: c.resourceId,
      status: c.status,
    })),
  };

  const preview = await prisma.procedureReplanPreview.create({
    data: {
      organizationId: satelliteOrganizationId(),
      tenantId: tenant.id,
      mode: input.mode,
      bakuDate: input.date,
      resourceId: input.resourceId ?? null,
      procedureTypeId: input.procedureTypeId ?? null,
      respectPins,
      scopeHash: scopeHash(input),
      payloadJson: JSON.stringify(payload),
      createdByUserId: actorUserId,
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
    },
  });

  return { previewId: preview.id, expiresAt: preview.expiresAt, ...payload };
}

async function snapshotOrders(ids: string[]): Promise<OrderSnap[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.procedureOrder.findMany({
    where: { id: { in: ids } },
    include: { allocations: true },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    scheduledAt: r.scheduledAt.toISOString(),
    endsAt: r.endsAt?.toISOString() ?? null,
    resourceId: r.resourceId,
    allocations: r.allocations.map((a) => ({
      role: a.role,
      resourceId: a.resourceId,
      practitionerId: a.practitionerId,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
    })),
  }));
}

async function unplaceOrders(ids: string[]) {
  if (ids.length === 0) return;
  await prisma.procedureAllocation.deleteMany({ where: { procedureOrderId: { in: ids } } });
  await prisma.procedureOrder.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "PROPOSED",
      resourceId: null,
      confirmedAt: null,
      confirmedByUserId: null,
    },
  });
}

export async function applyReplanPreview(input: {
  previewId: string;
  confirm: string;
  reason: string;
  actorUserId: string;
  nuclearAllowed: boolean;
}) {
  if (input.confirm !== "REPLAN") {
    throw new Error("Confirm phrase must be REPLAN");
  }
  const preview = await prisma.procedureReplanPreview.findUnique({ where: { id: input.previewId } });
  if (!preview) throw new Error("Preview not found");
  if (preview.expiresAt.getTime() < Date.now()) throw new Error("Preview expired");
  if (preview.appliedAt) throw new Error("Preview already applied");
  if (preview.mode === "NUCLEAR_DAY" && !input.nuclearAllowed) {
    throw new Error("Nuclear replan requires platform super-admin");
  }

  const payload = JSON.parse(preview.payloadJson) as { candidateIds: string[] };
  const ids = payload.candidateIds ?? [];
  const before = await snapshotOrders(ids);

  if (preview.mode !== "FILL_HOLES") {
    await unplaceOrders(ids);
  }
  await placeConfirmedProcedures(ids, { confirmedByUserId: input.actorUserId });

  const snapshot = await prisma.procedureReplanSnapshot.create({
    data: {
      organizationId: satelliteOrganizationId(),
      tenantId: preview.tenantId,
      previewId: preview.id,
      beforeJson: JSON.stringify(before),
      createdByUserId: input.actorUserId,
      expiresAt: new Date(Date.now() + UNDO_TTL_MS),
    },
  });
  await prisma.procedureReplanPreview.update({
    where: { id: preview.id },
    data: { appliedAt: new Date() },
  });
  return { applied: true, snapshotId: snapshot.id, orderCount: ids.length, reason: input.reason };
}

export async function undoReplan(snapshotId: string) {
  const snap = await prisma.procedureReplanSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snap) throw new Error("Snapshot not found");
  if (snap.undoneAt) throw new Error("Already undone");
  if (snap.expiresAt.getTime() < Date.now()) throw new Error("Undo window expired");
  const before = JSON.parse(snap.beforeJson) as OrderSnap[];
  const live = await prisma.procedureOrder.findMany({
    where: { id: { in: before.map((b) => b.id) } },
    select: { id: true, status: true },
  });
  if (live.some((r) => r.status === "CHECKED_IN" || r.status === "COMPLETED")) {
    throw new Error("Cannot undo: an order is already checked in or completed");
  }

  for (const row of before) {
    await prisma.procedureAllocation.deleteMany({ where: { procedureOrderId: row.id } });
    await prisma.procedureOrder.update({
      where: { id: row.id },
      data: {
        status: row.status as never,
        scheduledAt: new Date(row.scheduledAt),
        endsAt: row.endsAt ? new Date(row.endsAt) : null,
        resourceId: row.resourceId,
      },
    });
    if (row.allocations.length > 0) {
      await prisma.procedureAllocation.createMany({
        data: row.allocations.map((a) => ({
          procedureOrderId: row.id,
          role: a.role as never,
          resourceId: a.resourceId,
          practitionerId: a.practitionerId,
          startsAt: new Date(a.startsAt),
          endsAt: new Date(a.endsAt),
        })),
      });
    }
  }
  await prisma.procedureReplanSnapshot.update({
    where: { id: snap.id },
    data: { undoneAt: new Date() },
  });
  return { undone: true };
}
