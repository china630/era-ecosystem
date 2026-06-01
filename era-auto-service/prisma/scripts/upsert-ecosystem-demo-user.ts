/**
 * Upsert ecosystem demo ops user in a satellite DB.
 * Run from satellite root: npx tsx prisma/scripts/upsert-ecosystem-demo-user.ts
 */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
const { hashPassword } = require("@era/satellite-kit") as typeof import("@era/satellite-kit");

const login = (process.env.ECOSYSTEM_DEMO_LOGIN ?? "chingiz@era.com").toLowerCase();
const password = process.env.ECOSYSTEM_DEMO_PASSWORD ?? "12345678";
const adminRoleCode = process.env.ECOSYSTEM_DEMO_ADMIN_ROLE ?? "ADMIN";
const fullName = process.env.ECOSYSTEM_DEMO_FULL_NAME ?? "Chingiz Demo";

const prisma = new PrismaClient();

async function main() {
  const hash = await hashPassword(password);

  let role = await prisma.role.findUnique({ where: { code: adminRoleCode } });
  if (!role) {
    role = await prisma.role.findFirst({ orderBy: { code: "asc" } });
  }
  if (!role) {
    role = await prisma.role.create({
      data: {
        code: adminRoleCode,
        name: adminRoleCode.replace(/_/g, " "),
        permissionsJson: "[]",
      },
    });
    console.info(`[demo-user] created role ${adminRoleCode}`);
  }

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

  console.info(`[demo-user] upserted ${login} (${adminRoleCode})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
