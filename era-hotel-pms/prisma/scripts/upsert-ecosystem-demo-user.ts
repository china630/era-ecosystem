/**
 * Upsert platform super-admin / ecosystem demo users in a satellite DB.
 * Creates every email from PLATFORM_SUPER_ADMIN_EMAILS (defaults include
 * shirinov.chingiz@gmail.com) with Hotel_Admin role + full permissions +
 * bootstrap password.
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

const {
  ROLE_CODES,
  ROLE_PERMISSIONS,
  serializePermissions,
} = require("./src/lib/auth/permissions") as typeof import("../../src/lib/auth/permissions");

const password =
  process.env.ECOSYSTEM_DEMO_PASSWORD?.trim() ||
  platformSuperAdminBootstrapPassword();
const fullName = process.env.ECOSYSTEM_DEMO_FULL_NAME ?? "Platform Super Admin";
const adminRoleCode =
  process.env.ECOSYSTEM_DEMO_ADMIN_ROLE?.trim() || ROLE_CODES.HOTEL_ADMIN;

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
  const hash = await hashPassword(password);
  const perms =
    ROLE_PERMISSIONS[adminRoleCode as keyof typeof ROLE_PERMISSIONS] ??
    ROLE_PERMISSIONS[ROLE_CODES.HOTEL_ADMIN];
  const permissionsJson = serializePermissions(perms);

  let role = await prisma.role.findUnique({ where: { code: adminRoleCode } });
  if (!role) {
    role = await prisma.role.create({
      data: {
        code: adminRoleCode,
        name: adminRoleCode.replace(/_/g, " "),
        permissionsJson,
      },
    });
    console.info(`[demo-user] created role ${adminRoleCode}`);
  } else if (
    !role.permissionsJson ||
    role.permissionsJson === "[]" ||
    role.permissionsJson.trim() === "[]"
  ) {
    role = await prisma.role.update({
      where: { id: role.id },
      data: { permissionsJson },
    });
    console.info(`[demo-user] repaired empty permissionsJson on ${adminRoleCode}`);
  }

  for (const login of resolveLogins()) {
    await prisma.user.upsert({
      where: { login },
      create: {
        login,
        email: login,
        fullName,
        passwordHash: hash,
        roleId: role.id,
        status: "ACTIVE",
        isCrossSystem: true,
      },
      update: {
        email: login,
        fullName,
        passwordHash: hash,
        roleId: role.id,
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
