/**
 * Upsert platform super-admin / ecosystem demo users in a satellite DB.
 * Creates every email from PLATFORM_SUPER_ADMIN_EMAILS (defaults include
 * shirinov.chingiz@gmail.com) with max admin role + bootstrap password.
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
const { ensureSystemClinicRoles } = require("../../src/lib/auth/ensure-system-clinic-roles") as typeof import("../../src/lib/auth/ensure-system-clinic-roles");
const { CLINIC_ROLE } = require("../../src/lib/clinic-roles") as typeof import("../../src/lib/clinic-roles");
const { createSatelliteTenantExtension } = require("@era/satellite-kit/tenancy") as typeof import("@era/satellite-kit/tenancy");

const password =
  process.env.ECOSYSTEM_DEMO_PASSWORD?.trim() ||
  platformSuperAdminBootstrapPassword();
const adminRoleCode =
  process.env.ECOSYSTEM_DEMO_ADMIN_ROLE?.trim() || CLINIC_ROLE.CLINIC_ADMIN;
const fullName = process.env.ECOSYSTEM_DEMO_FULL_NAME ?? "Platform Super Admin";

function seedOrgId(): string {
  return (
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "demo-org"
  );
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
  const organizationId = seedOrgId();
  await ensureSystemClinicRoles(prisma, organizationId);

  const role =
    (await prisma.role.findFirst({
      where: { organizationId, code: adminRoleCode },
    })) ??
    (await prisma.role.findFirst({
      where: { organizationId, code: CLINIC_ROLE.CLINIC_ADMIN },
    }));
  if (!role) {
    throw new Error("CLINIC_ADMIN missing after ensureSystemClinicRoles");
  }

  const hash = await hashPassword(password);
  for (const login of resolveLogins()) {
    const existing = await prisma.user.findFirst({
      where: { organizationId, login },
    });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: login,
          fullName,
          passwordHash: hash,
          roleId: role.id,
          status: "ACTIVE",
          isCrossSystem: true,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          organizationId,
          login,
          email: login,
          fullName,
          passwordHash: hash,
          roleId: role.id,
          status: "ACTIVE",
          isCrossSystem: true,
        },
      });
    }
    console.info(`[demo-user] upserted ${login} (${role.code})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
