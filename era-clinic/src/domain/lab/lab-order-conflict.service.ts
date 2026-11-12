import { Prisma } from "@prisma/client";
import type { SatelliteTransactionClient } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export const LAB_ALREADY_OPEN = "LAB_ALREADY_OPEN";
export const LAB_ALREADY_COMPLETED = "LAB_ALREADY_COMPLETED";
/** Priced order still has no settledAt. A repeat must not open a second cheque. */
export const LAB_UNPAID_EXISTS = "LAB_UNPAID_EXISTS";

const OPEN_DUPLICATE_STATUSES = [
  "ORDERED",
  "COLLECTED",
  "IN_PROGRESS",
  "RESULT_READY",
] as const;

const COMPLETED_DUPLICATE_STATUSES = ["PUBLISHED", "COMPLETED"] as const;

export type EpisodeLabConflict = {
  kind: "OPEN" | "COMPLETED" | "UNPAID";
  orderId: string;
  testCode: string;
};

function orderServiceCodes(testCode: string, itemCodes: string[]): string[] {
  if (itemCodes.length > 0) return itemCodes;
  return testCode
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

type LabConflictDb = {
  labOrder: {
    findMany: (args: {
      where: { patientRefId?: string; clinicalEpisodeId?: string; status: { not: "CANCELLED" } };
      include: { items: { select: { serviceCode: true } } };
      orderBy: { createdAt: "desc" };
    }) => Promise<
      Array<{
        id: string;
        status: string;
        testCode: string;
        amountNet?: unknown;
        settledAt?: Date | null;
        items: Array<{ serviceCode: string }>;
      }>
    >;
  };
};

function scanConflicts(
  orders: Array<{
    id: string;
    status: string;
    testCode: string;
    amountNet?: unknown;
    settledAt?: Date | null;
    items: Array<{ serviceCode: string }>;
  }>,
  wanted: Set<string>,
): EpisodeLabConflict | null {
  let openHit: EpisodeLabConflict | null = null;
  let unpaidHit: EpisodeLabConflict | null = null;
  let completedHit: EpisodeLabConflict | null = null;
  for (const order of orders) {
    const codes = orderServiceCodes(
      order.testCode,
      order.items.map((i) => i.serviceCode),
    );
    const hit = codes.find((c) => wanted.has(c));
    if (!hit) continue;

    if (OPEN_DUPLICATE_STATUSES.includes(order.status as (typeof OPEN_DUPLICATE_STATUSES)[number])) {
      openHit = { kind: "OPEN", orderId: order.id, testCode: hit };
      break;
    }
    const pricedUnsettled = Number(order.amountNet) > 0 && !order.settledAt;
    if (
      !unpaidHit &&
      pricedUnsettled &&
      COMPLETED_DUPLICATE_STATUSES.includes(
        order.status as (typeof COMPLETED_DUPLICATE_STATUSES)[number],
      )
    ) {
      unpaidHit = { kind: "UNPAID", orderId: order.id, testCode: hit };
      continue;
    }
    if (
      !completedHit &&
      COMPLETED_DUPLICATE_STATUSES.includes(
        order.status as (typeof COMPLETED_DUPLICATE_STATUSES)[number],
      )
    ) {
      completedHit = { kind: "COMPLETED", orderId: order.id, testCode: hit };
    }
  }
  return openHit ?? unpaidHit ?? completedHit;
}

/** Same patient, any episode and orders with no episode. */
export async function findPatientLabConflict(
  patientRefId: string,
  testCodes: string[],
  db: LabConflictDb | SatelliteTransactionClient = prisma,
): Promise<EpisodeLabConflict | null> {
  const wanted = new Set(testCodes.map((c) => c.trim()).filter(Boolean));
  if (!patientRefId || wanted.size === 0) return null;

  const orders = await (db as LabConflictDb).labOrder.findMany({
    where: {
      patientRefId,
      status: { not: "CANCELLED" },
    },
    include: { items: { select: { serviceCode: true } } },
    orderBy: { createdAt: "desc" },
  });
  return scanConflicts(orders, wanted);
}

/** Finds an existing non-cancelled lab on the episode that overlaps any requested code. */
export async function findEpisodeLabConflict(
  clinicalEpisodeId: string,
  testCodes: string[],
): Promise<EpisodeLabConflict | null> {
  const wanted = new Set(testCodes.map((c) => c.trim()).filter(Boolean));
  if (wanted.size === 0) return null;

  const orders = await prisma.labOrder.findMany({
    where: {
      clinicalEpisodeId,
      status: { not: "CANCELLED" },
    },
    include: { items: { select: { serviceCode: true } } },
    orderBy: { createdAt: "desc" },
  });
  return scanConflicts(orders, wanted);
}

/** Serializes lab creates for one patient so two saves cannot both pass the open check. */
export async function lockPatientForLabCreate(
  db: SatelliteTransactionClient | Prisma.TransactionClient,
  patientRefId: string,
): Promise<void> {
  const client = db as Prisma.TransactionClient;
  const row = await client.patientRef.findUnique({
    where: { id: patientRefId },
    select: { refCode: true },
  });
  if (!row) return;
  await client.patientRef.update({
    where: { id: patientRefId },
    data: { refCode: row.refCode },
  });
}

export function assertLabOrderCanCreate(
  conflict: EpisodeLabConflict | null,
  confirmRepeat?: boolean,
): void {
  if (!conflict) return;
  if (conflict.kind === "OPEN") {
    const err = new Error(
      `An open lab order already exists for ${conflict.testCode} for this patient`,
    );
    (err as Error & { code?: string; testCode?: string }).code = LAB_ALREADY_OPEN;
    (err as Error & { testCode?: string }).testCode = conflict.testCode;
    throw err;
  }
  if (conflict.kind === "UNPAID") {
    const err = new Error(
      `Lab ${conflict.testCode} is already on this stay and its cheque is still unpaid`,
    );
    (err as Error & { code?: string; testCode?: string }).code = LAB_UNPAID_EXISTS;
    (err as Error & { testCode?: string }).testCode = conflict.testCode;
    throw err;
  }
  if (!confirmRepeat) {
    const err = new Error(
      `Lab ${conflict.testCode} was already completed for this patient`,
    );
    (err as Error & { code?: string; testCode?: string }).code =
      LAB_ALREADY_COMPLETED;
    (err as Error & { testCode?: string }).testCode = conflict.testCode;
    throw err;
  }
}
