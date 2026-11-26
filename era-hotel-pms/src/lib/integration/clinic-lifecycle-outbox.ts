import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { runWithSatelliteTenant } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { enterRequestTenant, requestOrganizationId } from "@/lib/request-organization";
import { publishLifecycle } from "@/lib/integration/guest-lifecycle-events";
import {
  clinicLifecycleDedupeKey,
  clinicLifecyclePayloadChanged,
} from "@/lib/integration/clinic-lifecycle-key";

let draining = false;

/** Bare client — no tenant extension — so due-org discovery does not unbound. */
let discoverPrisma: PrismaClient | undefined;

function outboxDiscoverPrisma(): PrismaClient {
  if (!discoverPrisma) {
    discoverPrisma = new PrismaClient({ log: ["error"] });
  }
  return discoverPrisma;
}

export async function rememberClinicLifecycle(input: {
  kind: string;
  reservationId: string;
  paxKey?: string | null;
  payload: Record<string, unknown>;
}): Promise<void> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    select: { organizationId: true },
  });
  let organizationId = reservation?.organizationId?.trim() ?? "";
  if (!organizationId) {
    try {
      organizationId = requestOrganizationId();
    } catch {
      organizationId = "";
    }
  }
  if (!organizationId || organizationId === "demo-org") {
    throw new Error("clinic lifecycle requires the stay organization");
  }
  const dedupeKey = clinicLifecycleDedupeKey(input);
  const existing = await prisma.clinicLifecycleOutbox.findUnique({
    where: { organizationId_dedupeKey: { organizationId, dedupeKey } },
  });
  const changed =
    !existing || clinicLifecyclePayloadChanged(existing.payload, input.payload);
  if (existing && !changed && existing.ackedAt) return;
  const correlationId = !existing || changed ? randomUUID() : existing.correlationId;
  await prisma.clinicLifecycleOutbox.upsert({
    where: { organizationId_dedupeKey: { organizationId, dedupeKey } },
    create: {
      organizationId,
      dedupeKey,
      kind: input.kind,
      reservationId: input.reservationId,
      paxKey: (input.paxKey ?? "").trim(),
      correlationId,
      payload: input.payload,
      nextAttemptAt: new Date(),
    },
    update: {
      kind: input.kind,
      correlationId,
      payload: input.payload,
      ackedAt: null,
      attempts: changed ? 0 : existing?.attempts ?? 0,
      lastError: null,
      nextAttemptAt: new Date(),
    },
  });
  void drainClinicLifecycleOutbox().catch((err) =>
    console.error("clinic lifecycle drain failed", err),
  );
}

function nextDelayMs(attempts: number): number {
  const seconds = Math.min(15 * 60, 15 * 2 ** Math.max(0, attempts - 1));
  return seconds * 1000;
}

async function drainDueForOrganization(
  organizationId: string,
  limit: number,
): Promise<number> {
  return runWithSatelliteTenant({ organizationId }, async () => {
    let sent = 0;
    const due = await prisma.clinicLifecycleOutbox.findMany({
      where: { ackedAt: null, nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
    });
    for (const row of due) {
      try {
        enterRequestTenant(row.organizationId);
        const event = {
          ...(row.payload as Record<string, unknown>),
          correlationId: row.correlationId,
        };
        await publishLifecycle(event, row.organizationId);
        await prisma.clinicLifecycleOutbox.update({
          where: { id: row.id },
          data: { ackedAt: new Date(), lastError: null },
        });
        sent += 1;
      } catch (err) {
        const attempts = row.attempts + 1;
        const message = err instanceof Error ? err.message : "clinic lifecycle send failed";
        await prisma.clinicLifecycleOutbox.update({
          where: { id: row.id },
          data: {
            attempts,
            lastError: message.slice(0, 500),
            nextAttemptAt: new Date(Date.now() + nextDelayMs(attempts)),
          },
        });
      }
    }
    return sent;
  });
}

/**
 * Orgs that actually have due outbox rows. Uses an unscoped Prisma client —
 * the tenant extension would throw SatelliteOrganizationUnboundError on SHARED
 * before Sync stamps topology, and orch pool lookup needs a matching baseUrl.
 */
export async function resolveLifecycleDrainOrgIds(): Promise<string[]> {
  const rows = await outboxDiscoverPrisma().clinicLifecycleOutbox.findMany({
    where: { ackedAt: null, nextAttemptAt: { lte: new Date() } },
    select: { organizationId: true },
    distinct: ["organizationId"],
    take: 100,
  });
  return [
    ...new Set(rows.map((r) => r.organizationId.trim()).filter(Boolean)),
  ];
}

/**
 * SHARED: poll each due org under tenant ALS. No due rows → quiet no-op
 * (do not spam orch/unbound warnings every 15s).
 */
export async function drainClinicLifecycleOutbox(limit = 20): Promise<number> {
  if (draining) return 0;
  draining = true;
  let sent = 0;
  try {
    const orgIds = await resolveLifecycleDrainOrgIds();
    if (!orgIds.length) return 0;
    const perOrg = Math.max(1, Math.ceil(limit / orgIds.length));
    for (const organizationId of orgIds) {
      sent += await drainDueForOrganization(organizationId, perOrg);
    }
    return sent;
  } finally {
    draining = false;
  }
}

let timer: ReturnType<typeof setInterval> | undefined;

export function startClinicLifecycleOutbox(): void {
  if (timer) return;
  timer = setInterval(() => {
    void drainClinicLifecycleOutbox().catch((err) =>
      console.error("clinic lifecycle drain failed", err),
    );
  }, 15_000);
  if (typeof timer.unref === "function") timer.unref();
}
