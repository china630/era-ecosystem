import { prisma } from "@/lib/prisma";
import { cabinMatchesGuest } from "@/domain/procedure/resource-sex";

/** Procedure codes whose listed cabins are all the other sex. No LOCATION row → not blocked. */
export async function blockedProcedureCodesForGuest(
  guestSex: string | null | undefined,
): Promise<Set<string>> {
  if (guestSex !== "MALE" && guestSex !== "FEMALE") return new Set();
  const [reqs, resources] = await Promise.all([
    prisma.procedureTypeRequirement.findMany({
      where: { role: { in: ["LOCATION", "EQUIPMENT"] } },
      select: {
        resourceCode: true,
        procedureType: { select: { code: true, resourceCode: true } },
      },
    }),
    prisma.resource.findMany({ select: { code: true, sexAudience: true } }),
  ]);
  const audience = new Map(resources.map((row) => [row.code, row.sexAudience]));
  const byCode = new Map<string, Array<"MALE" | "FEMALE" | "ANY" | null | undefined>>();
  for (const req of reqs) {
    const code = req.procedureType.code;
    const resourceCode = req.resourceCode?.trim() || req.procedureType.resourceCode?.trim();
    if (!resourceCode) continue;
    const list = byCode.get(code) ?? [];
    list.push(audience.get(resourceCode));
    byCode.set(code, list);
  }
  const blocked = new Set<string>();
  for (const [code, list] of byCode) {
    if (list.length === 0) continue;
    if (list.some((row) => cabinMatchesGuest(row, guestSex))) continue;
    blocked.add(code);
  }
  return blocked;
}

export async function procedureFitsGuestSex(
  procedureCode: string,
  guestSex: string | null | undefined,
): Promise<boolean> {
  const blocked = await blockedProcedureCodesForGuest(guestSex);
  return !blocked.has(procedureCode);
}
