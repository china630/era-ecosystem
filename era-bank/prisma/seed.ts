/**
 * Bank ops satellite — system role templates only (insert/update permissions carefully).
 * Demo teller/manager users: npm run db:seed:demo
 * Requires ERA_BANK_ORGANIZATION_ID or ERA_SATELLITE_ORGANIZATION_ID (no demo-org).
 */
import { createSatelliteTenantExtension } from "@era/satellite-kit";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  permissionsForRole,
  sanitizeLimitsJson,
  serializePermissions,
} from "../src/lib/auth/permissions";
import { BANK_PERMISSION_CATALOG_VERSION } from "../src/lib/auth/ensure-system-bank-roles";

const prisma = new PrismaClient().$extends(
  createSatelliteTenantExtension(Prisma as never) as never,
) as unknown as PrismaClient;

function requireBankOrgId(): string {
  const id =
    process.env.ERA_BANK_ORGANIZATION_ID?.trim() ||
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    "";
  if (!id || id === "demo-org" || id === "demo-bank-org-001") {
    throw new Error(
      "ERA_BANK_ORGANIZATION_ID required for bank seed; demo-org / demo-bank-org-001 are forbidden",
    );
  }
  return id;
}

const roles = [
  {
    code: "TELLER",
    name: "Teller",
    limitsJson: { maxDebitMinor: 500000, dailyPostingLimitAzn: 5000 },
  },
  {
    code: "BRANCH_MANAGER",
    name: "Branch manager",
    limitsJson: { maxDebitMinor: 5000000, dailyPostingLimitAzn: 50000 },
  },
  {
    code: "AML_OFFICER",
    name: "Compliance / AML",
    limitsJson: {},
  },
  {
    code: "CARDS_OFFICER",
    name: "Cards officer",
    limitsJson: {},
  },
  {
    code: "TREASURY_OFFICER",
    name: "Treasury officer",
    limitsJson: {},
  },
] as const;

async function seedRoles(organizationId: string) {
  for (const role of roles) {
    const existing = await prisma.opsRole.findUnique({
      where: {
        organizationId_code: { organizationId, code: role.code },
      },
    });
    const templateJson = serializePermissions(permissionsForRole(role.code));
    const limits = sanitizeLimitsJson(role.limitsJson);

    if (!existing) {
      await prisma.opsRole.create({
        data: {
          organizationId,
          code: role.code,
          name: role.name,
          limitsJson: limits,
          permissionsJson: templateJson,
          isSystem: true,
          permissionCatalogVersion: BANK_PERMISSION_CATALOG_VERSION,
        },
      });
      continue;
    }

    // Do not clobber a valid permissionsJson array (including intentional []).
    let permissionsJson = existing.permissionsJson;
    try {
      if (!Array.isArray(JSON.parse(permissionsJson))) {
        permissionsJson = templateJson;
      }
    } catch {
      permissionsJson = templateJson;
    }

    await prisma.opsRole.update({
      where: { id: existing.id },
      data: {
        name: role.name,
        limitsJson: limits,
        permissionsJson,
        isSystem: true,
        permissionCatalogVersion: BANK_PERMISSION_CATALOG_VERSION,
      },
    });
  }
}

async function main() {
  const organizationId = requireBankOrgId();
  process.env.ERA_BANK_ORGANIZATION_ID = organizationId;
  process.env.ERA_SATELLITE_ORGANIZATION_ID = organizationId;
  await seedRoles(organizationId);
  console.log(`Seeded bank ops roles for org ${organizationId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
