import { prisma } from "@/lib/prisma";
import { bakuDateKey } from "@/lib/baku-day";

/** Year-scoped inpatient chart number, e.g. 2026-0042 (Asia/Baku civil year). */
export async function nextInpatientCaseNumber(organizationId: string): Promise<string> {
  const year = bakuDateKey(new Date()).slice(0, 4);
  const prefix = `${year}-`;
  const latest = await prisma.inpatientAdmission.findFirst({
    where: {
      organizationId,
      caseNumber: { startsWith: prefix },
    },
    orderBy: { caseNumber: "desc" },
    select: { caseNumber: true },
  });
  const lastSeq = latest?.caseNumber
    ? Number.parseInt(latest.caseNumber.slice(prefix.length), 10)
    : 0;
  const next = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}