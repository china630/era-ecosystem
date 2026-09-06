/**
 * Split legacy full_name_cipher into first/middle/last cipher columns.
 * Requires PII_ENCRYPTION_KEY (same key used by MDM encrypt/decrypt).
 *
 * Run from era-orchestrator after migrate deploy:
 *   npx tsx packages/mdm-database/prisma/scripts/backfill-person-name-parts.ts
 *
 * Dry-run: DRY_RUN=1 npx tsx ...
 * Re-split rows that already have parts (AZ surname-first repair): FORCE=1
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/client";

loadEnv({ path: resolve(__dirname, "../../../../.env") });

const ALG = "aes-256-gcm";
const VERSION = "v1";
const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const force = process.env.FORCE === "1" || process.env.FORCE === "true";

function resolveKey(primaryName: string): Buffer {
  const raw = process.env[primaryName]?.trim();
  if (raw) {
    const asB64 = Buffer.from(raw, "base64");
    if (asB64.length >= 32) return createHash("sha256").update(asB64).digest();
    return createHash("sha256").update(raw).digest();
  }
  return createHash("sha256")
    .update(`${primaryName}:erafinance-dev-fallback`)
    .digest();
}

function encryptText(value: string): string {
  const key = resolveKey("PII_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

function decryptText(cipherPayload: string): string | null {
  try {
    const [version, ivB64, bodyB64, tagB64] = cipherPayload.split(".");
    if (version !== VERSION || !ivB64 || !bodyB64 || !tagB64) return null;
    const key = resolveKey("PII_ENCRYPTION_KEY");
    const iv = Buffer.from(ivB64, "base64url");
    const body = Buffer.from(bodyB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function composePersonFullName(
  firstName?: string | null,
  middleName?: string | null,
  lastName?: string | null,
): string {
  return [firstName, middleName, lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

const PATRONYMIC_PARTICLE_RE =
  /^(oğlu|oglu|oğli|ogli|qızı|qizi|kyzy|kizi|угли|углы|кызы)$/iu;

function isPatronymicParticle(token: string | null | undefined): boolean {
  return Boolean(token && PATRONYMIC_PARTICLE_RE.test(token.trim()));
}

/** Same heuristic as @era/satellite-kit splitFullNameToParts (AZ surname-first). */
function splitFullNameToParts(fullName: string): {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: null, middleName: null, lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: parts[0]!, middleName: null, lastName: null };
  }
  if (parts.length === 2) {
    return { firstName: parts[0]!, middleName: null, lastName: parts[1]! };
  }
  if (parts.length >= 3 && isPatronymicParticle(parts[parts.length - 1])) {
    return {
      lastName: parts[0]!,
      firstName: parts[1]!,
      middleName: parts.slice(2).join(" "),
    };
  }
  return {
    firstName: parts[0]!,
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1]!,
  };
}

function needsRepair(
  plain: string,
  firstNameCipher: string | null,
  lastNameCipher: string | null,
): boolean {
  if (!firstNameCipher || !lastNameCipher) return true;
  if (!force) return false;
  const lastPlain = decryptText(lastNameCipher)?.trim() || null;
  if (isPatronymicParticle(lastPlain)) return true;
  const tokens = plain.trim().split(/\s+/).filter(Boolean);
  return (
    tokens.length >= 3 &&
    isPatronymicParticle(tokens[tokens.length - 1]) &&
    lastPlain === tokens[tokens.length - 1]
  );
}

const url = process.env.MDM_DATABASE_URL;
if (!url) {
  throw new Error("MDM_DATABASE_URL is required");
}

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const persons = await prisma.globalNaturalPerson.findMany({
    where: force
      ? { fullNameCipher: { not: null } }
      : {
          fullNameCipher: { not: null },
          OR: [{ firstNameCipher: null }, { lastNameCipher: null }],
        },
    select: {
      id: true,
      fullNameCipher: true,
      firstNameCipher: true,
      middleNameCipher: true,
      lastNameCipher: true,
    },
  });

  let updated = 0;
  let skipped = 0;
  for (const p of persons) {
    if (!p.fullNameCipher) {
      skipped++;
      continue;
    }
    const plain = decryptText(p.fullNameCipher);
    if (!plain?.trim()) {
      skipped++;
      continue;
    }
    if (!needsRepair(plain, p.firstNameCipher, p.lastNameCipher)) {
      skipped++;
      continue;
    }
    const parts = splitFullNameToParts(plain);
    const fullName = composePersonFullName(
      parts.firstName,
      parts.middleName,
      parts.lastName,
    );
    if (!fullName) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(
        `[dry-run] ${p.id}: ${plain} → ${parts.firstName} | ${parts.middleName} | ${parts.lastName}`,
      );
      updated++;
      continue;
    }
    await prisma.globalNaturalPerson.update({
      where: { id: p.id },
      data: {
        firstNameCipher: parts.firstName ? encryptText(parts.firstName) : null,
        middleNameCipher: parts.middleName ? encryptText(parts.middleName) : null,
        lastNameCipher: parts.lastName ? encryptText(parts.lastName) : null,
        fullNameCipher: encryptText(fullName),
      },
    });
    updated++;
  }
  console.log(
    `Backfilled name parts: updated=${updated} skipped=${skipped} scanned=${persons.length}${
      dryRun ? " (dry-run)" : ""
    }${force ? " (force)" : ""}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
