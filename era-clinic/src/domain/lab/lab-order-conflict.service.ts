import { prisma } from "@/lib/prisma";

export const LAB_ALREADY_OPEN = "LAB_ALREADY_OPEN";
export const LAB_ALREADY_COMPLETED = "LAB_ALREADY_COMPLETED";

const OPEN_DUPLICATE_STATUSES = [
  "ORDERED",
  "COLLECTED",
  "IN_PROGRESS",
  "RESULT_READY",
] as const;

const COMPLETED_DUPLICATE_STATUSES = ["PUBLISHED", "COMPLETED"] as const;

export type EpisodeLabConflict = {
  kind: "OPEN" | "COMPLETED";
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

  for (const order of orders) {
    const codes = orderServiceCodes(
      order.testCode,
      order.items.map((i) => i.serviceCode),
    );
    const hit = codes.find((c) => wanted.has(c));
    if (!hit) continue;

    if (OPEN_DUPLICATE_STATUSES.includes(order.status as (typeof OPEN_DUPLICATE_STATUSES)[number])) {
      return { kind: "OPEN", orderId: order.id, testCode: hit };
    }
    if (
      COMPLETED_DUPLICATE_STATUSES.includes(
        order.status as (typeof COMPLETED_DUPLICATE_STATUSES)[number],
      )
    ) {
      return { kind: "COMPLETED", orderId: order.id, testCode: hit };
    }
  }

  return null;
}

export function assertLabOrderCanCreate(
  conflict: EpisodeLabConflict | null,
  confirmRepeat?: boolean,
): void {
  if (!conflict) return;
  if (conflict.kind === "OPEN") {
    const err = new Error(
      `An open lab order already exists for ${conflict.testCode} on this episode`,
    );
    (err as Error & { code?: string; testCode?: string }).code = LAB_ALREADY_OPEN;
    (err as Error & { testCode?: string }).testCode = conflict.testCode;
    throw err;
  }
  if (!confirmRepeat) {
    const err = new Error(
      `Lab ${conflict.testCode} was already completed for this episode`,
    );
    (err as Error & { code?: string; testCode?: string }).code =
      LAB_ALREADY_COMPLETED;
    (err as Error & { testCode?: string }).testCode = conflict.testCode;
    throw err;
  }
}
