import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Prisma P2025: the update target was already removed. */
export function isMissingProcedureOrder(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? (err as { code?: unknown }).code : undefined;
  if (code === "P2025") return true;
  const message = err instanceof Error ? err.message : "";
  return message.includes("No record was found for an update");
}

/**
 * Saxla deletes unseated PROPOSED rows, then later steps still hold their ids.
 * A missing row is skipped. The save continues.
 */
export async function updateProcedureOrderIfPresent(
  orderId: string,
  data: Prisma.ProcedureOrderUncheckedUpdateInput,
  step: string,
): Promise<boolean> {
  const existing = await prisma.procedureOrder.findUnique({
    where: { id: orderId },
    select: { id: true },
  });
  if (!existing) {
    console.warn("procedure-order-missing", { step, orderId });
    return false;
  }
  try {
    await prisma.procedureOrder.update({ where: { id: orderId }, data });
    return true;
  } catch (err) {
    if (!isMissingProcedureOrder(err)) throw err;
    console.warn("procedure-order-missing", { step, orderId });
    return false;
  }
}
