/**
 * Upsert platform super-admins into era_orchestrator (canonical IdP).
 * Usage: DATABASE_URL=... npx tsx prisma/scripts/bootstrap-platform-admins.ts [--reset-password]
 */
import { createPrismaClient, closePrismaPool } from "../prisma-client";
import { upsertPlatformSuperAdmins } from "../lib/platform/upsert-platform-super-admins";

async function main() {
  const reset = process.argv.includes("--reset-password");
  const mode = reset ? "reset_password" : "preserve_password";
  const prisma = createPrismaClient();
  try {
    await upsertPlatformSuperAdmins(prisma, mode);
    process.stdout.write(
      `[orch bootstrap] platform super-admins upserted (mode=${mode})\n`,
    );
  } finally {
    await prisma.$disconnect();
    await closePrismaPool();
  }
}

main().catch((e) => {
  process.stderr.write(`${e}\n`);
  process.exit(1);
});
