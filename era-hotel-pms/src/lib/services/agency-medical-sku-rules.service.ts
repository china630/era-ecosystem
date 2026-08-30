import { prisma } from "@/lib/prisma";
import {
  MEDICAL_PACKAGE_CODES,
  normalizeMedicalPackageCode,
  type AgencySkuRuleInput,
  type MedicalPackageCode,
} from "@/lib/services/medical-package-resolve.service";
import { requestOrganizationId } from "@/lib/request-organization";

/**
 * Default seed when AgencyMedicalSkuRule table empty.
 * Longest prefixes first in resolve; include EW 2026 FO-with-Notes agency labels.
 */
export const DEFAULT_AGENCY_SKU_RULES: Array<{
  agencyNamePrefix: string;
  packageCode: MedicalPackageCode;
  sortOrder: number;
}> = [
  // Premium (specific → broad)
  { agencyNamePrefix: "Premium paket Walkin", packageCode: "PKG-PREMIUM", sortOrder: 10 },
  { agencyNamePrefix: "Premium Facebook", packageCode: "PKG-PREMIUM", sortOrder: 11 },
  { agencyNamePrefix: "Premium Sultan Travel", packageCode: "PKG-PREMIUM", sortOrder: 12 },
  { agencyNamePrefix: "Premium Naftalan Kamel", packageCode: "PKG-PREMIUM", sortOrder: 13 },
  { agencyNamePrefix: "Premium Naftalan Med", packageCode: "PKG-PREMIUM", sortOrder: 14 },
  { agencyNamePrefix: "Premium Akmaral", packageCode: "PKG-PREMIUM", sortOrder: 15 },
  { agencyNamePrefix: "Premium", packageCode: "PKG-PREMIUM", sortOrder: 19 },
  // Dermo
  { agencyNamePrefix: "Dermo paket Walkin", packageCode: "PKG-DERMO", sortOrder: 20 },
  { agencyNamePrefix: "Dermo Naftalanium", packageCode: "PKG-DERMO", sortOrder: 21 },
  { agencyNamePrefix: "Dermo Naftalan Med", packageCode: "PKG-DERMO", sortOrder: 22 },
  { agencyNamePrefix: "Dermo Naftalan Kamel", packageCode: "PKG-DERMO", sortOrder: 23 },
  { agencyNamePrefix: "Dermo Nafdan", packageCode: "PKG-DERMO", sortOrder: 24 },
  { agencyNamePrefix: "Dermo RN", packageCode: "PKG-DERMO", sortOrder: 25 },
  { agencyNamePrefix: "Fecebook Dermo", packageCode: "PKG-DERMO", sortOrder: 26 },
  { agencyNamePrefix: "Facebook Dermo", packageCode: "PKG-DERMO", sortOrder: 27 },
  { agencyNamePrefix: "Dermo", packageCode: "PKG-DERMO", sortOrder: 29 },
  // Detoks
  { agencyNamePrefix: "Detox paket Walkin", packageCode: "PKG-DETOKS", sortOrder: 30 },
  { agencyNamePrefix: "Detoks paket Walkin", packageCode: "PKG-DETOKS", sortOrder: 31 },
  { agencyNamePrefix: "Detox", packageCode: "PKG-DETOKS", sortOrder: 32 },
  { agencyNamePrefix: "Detoks", packageCode: "PKG-DETOKS", sortOrder: 33 },
  // Həmkarlar → Standart
  { agencyNamePrefix: "Həmkarlar İttifaqı", packageCode: "PKG-STANDART", sortOrder: 40 },
  { agencyNamePrefix: "Həmkarlar", packageCode: "PKG-STANDART", sortOrder: 41 },
  { agencyNamePrefix: "Hemkarlar", packageCode: "PKG-STANDART", sortOrder: 42 },
  // Standart walk-in label
  { agencyNamePrefix: "Standart paket Walkin", packageCode: "PKG-STANDART", sortOrder: 50 },
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
