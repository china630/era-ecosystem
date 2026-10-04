import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { BODY_PART_CODES } from "@/lib/body-part-codes";

/** Seed ClinicLookup BODY_PART from the canonical codes when the org list is empty. */
export async function ensureBodyPartLookups() {
  const organizationId = requestOrganizationId();
  const existing = await prisma.clinicLookup.count({
    where: { kind: "BODY_PART" },
  });
  if (existing > 0) return;
  await prisma.clinicLookup.createMany({
    data: BODY_PART_CODES.map((code, index) => ({
      organizationId,
      kind: "BODY_PART" as const,
      code,
      name: code,
      sortOrder: index,
      active: true,
    })),
  });
}

export async function activeBodyPartCodes(): Promise<Set<string>> {
  await ensureBodyPartLookups();
  const rows = await prisma.clinicLookup.findMany({
    where: { kind: "BODY_PART", active: true },
    select: { code: true },
  });
  return new Set(rows.map((row) => row.code));
}
