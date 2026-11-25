/**
 * Rotate CRM_INTEGRATIONS_KEK (ADR B7 / cross-cutting DoD #18).
 *
 *   CRM_INTEGRATIONS_KEK_PREV=<old> CRM_INTEGRATIONS_KEK_NEW=<new> \
 *     npx tsx prisma/scripts/rotate-integrations-kek.ts
 *
 * Fail-closed: both keys required; no JWT fallback.
 */
import { PrismaClient } from "@prisma/client";
import {
  decryptSecretsJson,
  encryptSecretsJson,
} from "@era/integrations-kit";

async function main() {
  const prev = process.env.CRM_INTEGRATIONS_KEK_PREV?.trim();
  const next = process.env.CRM_INTEGRATIONS_KEK_NEW?.trim();
  if (!prev || !next) {
    throw new Error(
      "Set CRM_INTEGRATIONS_KEK_PREV (old) and CRM_INTEGRATIONS_KEK_NEW (target)",
    );
  }
  const prisma = new PrismaClient();
  const rows = await prisma.integrationConnection.findMany({
    select: { id: true, secretsEnc: true, secretsKeyVer: true },
  });
  let ok = 0;
  for (const row of rows) {
    if (!row.secretsEnc) continue;
    process.env.CRM_INTEGRATIONS_KEK = prev;
    const secrets = decryptSecretsJson(row.secretsEnc);
    process.env.CRM_INTEGRATIONS_KEK = next;
    const enc = encryptSecretsJson(secrets);
    await prisma.integrationConnection.update({
      where: { id: row.id },
      data: {
        secretsEnc: enc,
        secretsKeyVer: (row.secretsKeyVer ?? 1) + 1,
      },
    });
    ok += 1;
  }
  console.log(`Rotated secretsEnc on ${ok} connection(s)`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
