import { createSatelliteTenantExtension, hashPassword } from "@era/satellite-kit";
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

const DEMO_BRANCH_ID = "demo-branch-hq";
const DEMO_PASSWORD = "demo1234";
const ORG_ID =
  process.env.ERA_BANK_ORGANIZATION_ID?.trim() ||
  process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
  "demo-org";

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

const users = [
  {
    username: "teller-a",
    fullName: "Aysel Mammadova (Teller)",
    roleCode: "TELLER",
  },
  {
    username: "manager-b",
    fullName: "Rashad Aliyev (Branch manager)",
    roleCode: "BRANCH_MANAGER",
  },
  {
    username: "compliance",
    fullName: "Leyla Hasanova (Compliance)",
    roleCode: "AML_OFFICER",
  },
  {
    username: "cards-officer",
    fullName: "Orxan Quliyev (Cards)",
    roleCode: "CARDS_OFFICER",
  },
  {
    username: "treasury",
    fullName: "Nigar Suleymanova (Treasury)",
    roleCode: "TREASURY_OFFICER",
  },
] as const;

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const role of roles) {
    const existing = await prisma.opsRole.findUnique({
      where: {
        organizationId_code: { organizationId: ORG_ID, code: role.code },
      },
    });
    const templateJson = serializePermissions(permissionsForRole(role.code));
    const limits = sanitizeLimitsJson(role.limitsJson);

    if (!existing) {
      await prisma.opsRole.create({
        data: {
          organizationId: ORG_ID,
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

  for (const user of users) {
    const role = await prisma.opsRole.findUniqueOrThrow({
      where: {
        organizationId_code: { organizationId: ORG_ID, code: user.roleCode },
      },
    });
    await prisma.opsUser.upsert({
      where: {
        organizationId_username: {
          organizationId: ORG_ID,
          username: user.username,
        },
      },
      update: {
        fullName: user.fullName,
        passwordHash,
        branchId: DEMO_BRANCH_ID,
        opsRoleId: role.id,
        status: "ACTIVE",
      },
      create: {
        organizationId: ORG_ID,
        username: user.username,
        fullName: user.fullName,
        passwordHash,
        branchId: DEMO_BRANCH_ID,
        opsRoleId: role.id,
        status: "ACTIVE",
      },
    });
  }

  console.log(`Seeded bank ops roles/users for org ${ORG_ID}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
