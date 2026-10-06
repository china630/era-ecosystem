import { todayBakuYmd } from "@era/satellite-kit/time";
import { prisma } from "@/lib/prisma";

/** One number per Pay click: Baku day + per-org counter, at least 3 digits. */
export async function allocateClinicReceiptNo(organizationId: string): Promise<string> {
  const dayKey = todayBakuYmd().replace(/-/g, "");
  const row = await prisma.clinicReceiptSeq.upsert({
    where: { organizationId_dayKey: { organizationId, dayKey } },
    create: { organizationId, dayKey, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });
  return `${dayKey}-${String(row.lastSeq).padStart(3, "0")}`;
}
