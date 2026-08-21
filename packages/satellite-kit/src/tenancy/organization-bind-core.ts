import fs from "node:fs";
import path from "node:path";
import { onSatelliteRuntimeBoot } from "./runtime-config-core";
import {
  getRuntimeOrganizationId,
  resetOrganizationBindRuntimeForTests,
  resolveSatelliteOrganizationId as resolveFromRuntime,
  setRuntimeOrganizationId,
  type OrganizationBindSource,
} from "./organization-bind-runtime";

export {
  getRuntimeOrganizationId,
  setRuntimeOrganizationId,
  SatelliteOrganizationUnboundError,
  type OrganizationBindSource,
} from "./organization-bind-runtime";

const BIND_TABLE = "_era_organization_bind";

export type OrgBindPrisma = {
  $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<unknown>;
  $queryRawUnsafe: <T = unknown>(sql: string, ...values: unknown[]) => Promise<T>;
};

let fileHydrated = false;

export function organizationBindFilePath(): string {
  const fromEnv = process.env.ERA_ORG_BIND_FILE?.trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), ".data", "organization-bind.json");
}

function readBindFile(): string | null {
  try {
    const raw = fs.readFileSync(organizationBindFilePath(), "utf8");
    const parsed = JSON.parse(raw) as { organizationId?: string };
    const id = parsed.organizationId?.trim();
    return id || null;
  } catch {
    return null;
  }
}

export function writeOrganizationBindFile(
  organizationId: string,
  boundBy?: string,
): void {
  const filePath = organizationBindFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        organizationId,
        boundBy: boundBy ?? null,
        boundAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function hydrateFromFileOnce(): void {
  if (fileHydrated) return;
  fileHydrated = true;
  if (getRuntimeOrganizationId()) return;
  const fromFile = readBindFile();
  if (fromFile) {
    setRuntimeOrganizationId(fromFile);
  }
}

/**
 * Resolve deployment org id. Prefer runtime bind / file over env so Sync
 * survives without editing compose `.env`.
 *
 * Order: runtime → file → env → fallback `demo-org` (non-production only).
 */
export function resolveSatelliteOrganizationId(opts?: {
  allowFallback?: boolean;
}): {
  organizationId: string;
  source: OrganizationBindSource;
} {
  hydrateFromFileOnce();
  return resolveFromRuntime(opts);
}

/**
 * Hydrate org bind from Postgres into runtime (+ process.env) at process start.
 * Call from satellite `instrumentation.ts` / Nest bootstrap so recreate without
 * `.data/` volume still recovers the last Sync bind.
 * Also hydrates desired-state runtime config when present.
 */
export async function onSatelliteBoot(opts: {
  prisma?: OrgBindPrisma | null;
}): Promise<{ organizationId: string | null; source: OrganizationBindSource | "none" }> {
  await onSatelliteRuntimeBoot({ prisma: opts.prisma ?? null });

  if (opts.prisma) {
    const id = await hydrateOrganizationBindFromDb(opts.prisma);
    if (id) {
      return { organizationId: id, source: "db" };
    }
  }
  hydrateFromFileOnce();
  if (getRuntimeOrganizationId()) {
    return { organizationId: getRuntimeOrganizationId(), source: "runtime" };
  }
  const fromEnv =
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ERA_BANK_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "";
  if (fromEnv) {
    return { organizationId: fromEnv, source: "env" };
  }
  return { organizationId: null, source: "none" };
}

/** Test-only: clear in-memory bind and file-hydrate latch. */
export function resetOrganizationBindForTests(): void {
  resetOrganizationBindRuntimeForTests();
  fileHydrated = false;
}

export async function ensureOrganizationBindTable(
  prisma: OrgBindPrisma,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${BIND_TABLE}" (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      "organizationId" TEXT NOT NULL,
      "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "boundBy" TEXT
    )
  `);
}

export async function loadOrganizationBindFromDb(
  prisma: OrgBindPrisma,
): Promise<string | null> {
  try {
    await ensureOrganizationBindTable(prisma);
    const rows = await prisma.$queryRawUnsafe<
      Array<{ organizationId: string }>
    >(`SELECT "organizationId" FROM "${BIND_TABLE}" WHERE id = 1 LIMIT 1`);
    return rows[0]?.organizationId?.trim() || null;
  } catch {
    return null;
  }
}

export async function saveOrganizationBindToDb(
  prisma: OrgBindPrisma,
  organizationId: string,
  boundBy?: string,
): Promise<void> {
  await ensureOrganizationBindTable(prisma);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${BIND_TABLE}" (id, "organizationId", "boundAt", "boundBy")
     VALUES (1, $1, NOW(), $2)
     ON CONFLICT (id) DO UPDATE SET
       "organizationId" = EXCLUDED."organizationId",
       "boundAt" = NOW(),
       "boundBy" = EXCLUDED."boundBy"`,
    organizationId,
    boundBy ?? null,
  );
}

export async function hydrateOrganizationBindFromDb(
  prisma: OrgBindPrisma,
): Promise<string | null> {
  const id = await loadOrganizationBindFromDb(prisma);
  if (id) setRuntimeOrganizationId(id);
  return id;
}

export async function applyOrganizationBind(opts: {
  organizationId: string;
  boundBy?: string;
  prisma?: OrgBindPrisma | null;
}): Promise<{ organizationId: string }> {
  const organizationId = opts.organizationId.trim();
  setRuntimeOrganizationId(organizationId);
  writeOrganizationBindFile(organizationId, opts.boundBy);
  if (opts.prisma) {
    await saveOrganizationBindToDb(opts.prisma, organizationId, opts.boundBy);
  }
  return { organizationId };
}

