import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { NextResponse } from "next/server";
import { assertEnvServiceToken } from "../auth/assert-service-token";

const BIND_TABLE = "_era_organization_bind";

export type OrgBindPrisma = {
  $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<unknown>;
  $queryRawUnsafe: <T = unknown>(sql: string, ...values: unknown[]) => Promise<T>;
};

export type OrganizationBindSource =
  | "runtime"
  | "file"
  | "db"
  | "env"
  | "fallback";

let runtimeOrganizationId: string | null = null;
let fileHydrated = false;

const bindBodySchema = z.object({
  organizationId: z.string().uuid(),
  boundBy: z.string().max(200).optional(),
});

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

export function setRuntimeOrganizationId(organizationId: string | null): void {
  const id = organizationId?.trim() || null;
  runtimeOrganizationId = id;
  if (id) {
    process.env.ERA_SATELLITE_ORGANIZATION_ID = id;
  }
}

export function getRuntimeOrganizationId(): string | null {
  return runtimeOrganizationId;
}

function hydrateFromFileOnce(): void {
  if (fileHydrated) return;
  fileHydrated = true;
  if (runtimeOrganizationId) return;
  const fromFile = readBindFile();
  if (fromFile) {
    setRuntimeOrganizationId(fromFile);
  }
}

/**
 * Resolve deployment org id. Prefer runtime bind / file over env so Sync
 * survives without editing compose `.env`.
 */
export function resolveSatelliteOrganizationId(): {
  organizationId: string;
  source: OrganizationBindSource;
} {
  hydrateFromFileOnce();
  if (runtimeOrganizationId) {
    return { organizationId: runtimeOrganizationId, source: "runtime" };
  }
  const fromEnv =
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "";
  if (fromEnv) {
    return { organizationId: fromEnv, source: "env" };
  }
  return { organizationId: "demo-org", source: "fallback" };
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

export type OrganizationBindHandlerOptions = {
  getPrisma?: () => OrgBindPrisma | null | undefined;
};

/**
 * Next.js App Router handlers for POST/GET organization bind.
 */
export function createOrganizationBindHandlers(
  opts: OrganizationBindHandlerOptions = {},
) {
  async function authorize(request: Request) {
    return assertEnvServiceToken({
      expectedEnvKeys: [
        "SATELLITE_EVENT_SERVICE_TOKEN",
        "CLINIC_INTERNAL_SERVICE_TOKEN",
      ],
      authorization: request.headers.get("authorization"),
      xServiceToken: request.headers.get("x-service-token"),
    });
  }

  async function GET(request: Request) {
    const auth = await authorize(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const prisma = opts.getPrisma?.() ?? null;
    if (prisma) {
      await hydrateOrganizationBindFromDb(prisma);
    }
    const resolved = resolveSatelliteOrganizationId();
    return NextResponse.json({
      ok: true,
      organizationId: resolved.organizationId,
      source: resolved.source,
    });
  }

  async function POST(request: Request) {
    const auth = await authorize(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    let body: z.infer<typeof bindBodySchema>;
    try {
      body = bindBodySchema.parse(await request.json());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid body";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const prisma = opts.getPrisma?.() ?? null;
    await applyOrganizationBind({
      organizationId: body.organizationId,
      boundBy: body.boundBy,
      prisma,
    });
    return NextResponse.json({
      ok: true,
      organizationId: body.organizationId,
      source: "runtime" as const,
    });
  }

  return { GET, POST };
}
