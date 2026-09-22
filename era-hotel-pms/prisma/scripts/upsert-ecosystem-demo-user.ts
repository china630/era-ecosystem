/**
 * Upsert platform super-admin / ecosystem demo users in hotel DB.
 * Requires ERA_SATELLITE_ORGANIZATION_ID (demo-org forbidden). Manual only — not entrypoint.
 *
 * Run from satellite root: npx tsx prisma/scripts/upsert-ecosystem-demo-user.ts
 */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { Prisma, PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
const {
  hashPassword,
  platformSuperAdminEmails,
  platformSuperAdminBootstrapPassword,
} = require("@era/satellite-kit") as typeof import("@era/satellite-kit");
const { createSatelliteTenantExtension } = require("@era/satellite-kit/tenancy") as typeof import("@era/satellite-kit/tenancy");

const { ROLE_CODES } = require("../../src/lib/auth/permissions") as typeof import("../../src/lib/auth/permissions");
const { ensureHotelAdminRole } = require("../../src/lib/auth/ensure-system-hotel-roles") as typeof import("../../src/lib/auth/ensure-system-hotel-roles");

const password =
  process.env.ECOSYSTEM_DEMO_PASSWORD?.trim() ||
  platformSuperAdminBootstrapPassword();
const fullName = process.env.ECOSYSTEM_DEMO_FULL_NAME ?? "Platform Super Admin";
const adminRoleCode =
  process.env.ECOSYSTEM_DEMO_ADMIN_ROLE?.trim() || ROLE_CODES.HOTEL_ADMIN;

function requireSeedOrgId(): string {
  const id =
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "";
  if (!id || id === "demo-org" || id === "demo-clinic-org" || id === "demo-bank-org-001") {
    throw new Error(
      "ERA_SATELLITE_ORGANIZATION_ID required; demo-org is forbidden",
    );
  }
  return id;
}

function resolveLogins(): string[] {
  const emails = [...platformSuperAdminEmails()];
  const extra = process.env.ECOSYSTEM_DEMO_LOGIN?.trim().toLowerCase();
  if (extra?.includes("@") && !emails.includes(extra)) {
    emails.push(extra);
  }
  return emails;
}

const prisma = new PrismaClient().$extends(
  createSatelliteTenantExtension(Prisma as never) as never,
) as unknown as InstanceType<typeof PrismaClient>;

async function main() {
  const organizationId = requireSeedOrgId();
  process.env.ERA_SATELLITE_ORGANIZATION_ID = organizationId;
  const hash = await hashPassword(password);
  const adminRole =
    adminRoleCode === ROLE_CODES.HOTEL_ADMIN
      ? await ensureHotelAdminRole(prisma, organizationId)
      : await (async () => {
          const { ensureSystemHotelRoles } = require("../../src/lib/auth/ensure-system-hotel-roles") as typeof import("../../src/lib/auth/ensure-system-hotel-roles");
          await ensureSystemHotelRoles(prisma, organizationId);
          const role = await prisma.role.findFirst({
            where: { organizationId, code: adminRoleCode },
          });
          if (!role) throw new Error(`Role ${adminRoleCode} missing after ensure`);
          return role;
        })();

  for (const login of resolveLogins()) {
    await prisma.user.upsert({
      where: { organizationId_login: { organizationId, login } },
      create: {
        organizationId,
        login,
        email: login,
        fullName,
        passwordHash: hash,
        roleId: adminRole.id,
        status: "ACTIVE",
        isCrossSystem: true,
      },
      update: {
        email: login,
        fullName,
        passwordHash: hash,
        roleId: adminRole.id,
        status: "ACTIVE",
        isCrossSystem: true,
      },
    });
    console.info(`[demo-user] upserted ${login} → ${adminRoleCode}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
