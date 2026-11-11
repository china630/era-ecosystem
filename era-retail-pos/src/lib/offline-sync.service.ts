import { prisma } from "@/lib/prisma";

export async function enqueueOfflineReceipts(clientId: string, receipts: Record<string, unknown>[]) {
  return Promise.all(
    receipts.map((payload) =>
      prisma.offlineReceiptQueue.create({
        data: {
          clientId,
          payloadJson: JSON.stringify(payload),
          status: "PENDING",
        },
      }),
    ),
  );
}

export async function listPendingOfflineReceipts(clientId: string | null) {
  return prisma.offlineReceiptQueue.findMany({
    where: { status: "PENDING", ...(clientId ? { clientId } : {}) },
    take: 50,
  });
}
