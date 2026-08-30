import { prisma } from "@/lib/prisma";
import {
  MEDICAL_PACKAGE_CODES,
  normalizeMedicalPackageCode,
  type AgencySkuRuleInput,
  type MedicalPackageCode,
} from "@/lib/services/medical-package-resolve.service";
import { requestOrganizationId } from "@/lib/request-organization";

/** Default seed rows when table empty (Wave A hardcoded prefixes). */
export const DEFAULT_AGENCY_SKU_RULES: Array<{
  agencyNamePrefix: string;
  packageCode: MedicalPackageCode;
  sortOrder: number;
}> = [
  { agencyNamePrefix: "Premium", packageCode: "PKG-PREMIUM", sortOrder: 10 },
  { agencyNamePrefix: "Premium paket Walkin", packageCode: "PKG-PREMIUM", sortOrder: 11 },
  { agencyNamePrefix: "Premium Facebook", packageCode: "PKG-PREMIUM", sortOrder: 12 },
  { agencyNamePrefix: "Dermo", packageCode: "PKG-DERMO", sortOrder: 20 },
  { agencyNamePrefix: "Dermo paket Walkin", packageCode: "PKG-DERMO", sortOrder: 21 },
  { agencyNamePrefix: "Fecebook Dermo", packageCode: "PKG-DERMO", sortOrder: 22 },
  { agencyNamePrefix: "Detox", packageCode: "PKG-DETOKS", sortOrder: 30 },
  { agencyNamePrefix: "Detoks", packageCode: "PKG-DETOKS", sortOrder: 31 },
  { agencyNamePrefix: "Həmkarlar", packageCode: "PKG-STANDART", sortOrder: 40 },
  { agencyNamePrefix: "Hemkarlar", packageCode: "PKG-STANDART", sortOrder: 41 },
];

export async function ensureAgencyMedicalSkuRulesSeeded() {
  const orgId = requestOrganizationId();
  const count = await prisma.agencyMedicalSkuRule.count({
    where: orgId && orgId !== "demo-org" ? { organizationId: orgId } : undefined,
  });
  if (count > 0) return;
  const organizationId =
    orgId && orgId !== "demo-org"
      ? orgId
      : (
          await prisma.agency.findFirst({ select: { organizationId: true } })
        )?.organizationId ?? "demo-org";
  for (const row of DEFAULT_AGENCY_SKU_RULES) {
    await prisma.agencyMedicalSkuRule.create({
      data: {
        organizationId,
        agencyNamePrefix: row.agencyNamePrefix,
        packageCode: row.packageCode,
        sortOrder: row.sortOrder,
        active: true,
      },
    });
  }
}

export async function listAgencyMedicalSkuRules() {
  await ensureAgencyMedicalSkuRulesSeeded();
  return prisma.agencyMedicalSkuRule.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { agencyNamePrefix: "asc" }],
  });
}

export async function listAgencySkuRulesForResolve(): Promise<AgencySkuRuleInput[]> {
  try {
    await ensureAgencyMedicalSkuRulesSeeded();
    const rows = await prisma.agencyMedicalSkuRule.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return rows
      .map((r) => {
        const code = normalizeMedicalPackageCode(r.packageCode);
        if (!code) return null;
        return { agencyNamePrefix: r.agencyNamePrefix, packageCode: code };
      })
      .filter((x): x is AgencySkuRuleInput => x != null);
  } catch {
    return DEFAULT_AGENCY_SKU_RULES.map((r) => ({
      agencyNamePrefix: r.agencyNamePrefix,
      packageCode: r.packageCode,
    }));
  }
}

export async function upsertAgencyMedicalSkuRule(input: {
  id?: string;
  agencyNamePrefix: string;
  packageCode: string;
  sortOrder?: number;
  active?: boolean;
}) {
  const code = normalizeMedicalPackageCode(input.packageCode);
  if (!code || !MEDICAL_PACKAGE_CODES.includes(code)) {
    throw new Error("Invalid packageCode");
  }
  const orgId = requestOrganizationId();
  const organizationId =
    orgId && orgId !== "demo-org"
      ? orgId
      : (
          await prisma.agency.findFirst({ select: { organizationId: true } })
        )?.organizationId ?? "demo-org";
  if (input.id) {
    return prisma.agencyMedicalSkuRule.update({
      where: { id: input.id },
      data: {
        agencyNamePrefix: input.agencyNamePrefix.trim(),
        packageCode: code,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
      },
    });
  }
  return prisma.agencyMedicalSkuRule.create({
    data: {
      organizationId,
      agencyNamePrefix: input.agencyNamePrefix.trim(),
      packageCode: code,
      sortOrder: input.sortOrder ?? 0,
      active: input.active ?? true,
    },
  });
}

export async function retireAgencyMedicalSkuRule(id: string) {
  return prisma.agencyMedicalSkuRule.update({
    where: { id },
    data: { active: false },
  });
}
