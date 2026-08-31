import { prisma } from "@/lib/prisma";

export const LAB_NOT_ORDERED = "LAB_NOT_ORDERED";

export async function cancelLabOrder(
  id: string,
  input: { userId: string; reason?: string | null },
) {
  const order = await prisma.labOrder.findUnique({ where: { id } });
  if (!order) {
    const err = new Error("Lab order not found");
    (err as Error & { code?: string }).code = "NOT_FOUND";
    throw err;
  }
  if (order.status !== "ORDERED") {
    const err = new Error("Only ORDERED lab orders can be cancelled");
    (err as Error & { code?: string }).code = LAB_NOT_ORDERED;
    throw err;
  }

  return prisma.labOrder.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledByUserId: input.userId,
      cancelReason: input.reason?.trim() || null,
    },
    include: {
      patientRef: true,
      items: {
        include: { diagnosticService: { include: { modality: true } } },
      },
    },
  });
}
