import fs from "node:fs";
import path from "node:path";
import type { OrgBindPrisma } from "./organization-bind-core";
import {
  applyEnvSideEffects,
  getRuntimeConfigMemory,
  resetRuntimeConfigMemoryForTests,
  setRuntimeConfigMemory,
  type SatelliteRuntimeConfig,
} from "./runtime-config-memory";

export type { SatelliteRuntimeConfig } from "./runtime-config-memory";
export { getRuntimeSsoSharedSecret } from "./runtime-config-memory";

const CONFIG_TABLE = "_era_runtime_config";

let fileHydrated = false;

export function runtimeConfigFilePath(): string {
  const fromEnv = process.env.ERA_RUNTIME_CONFIG_FILE?.trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), ".data", "runtime-config.json");
}

function readConfigFile(): SatelliteRuntimeConfig | null {
  try {
    const raw = fs.readFileSync(runtimeConfigFilePath(), "utf8");
    return JSON.parse(raw) as SatelliteRuntimeConfig;
  } catch {
    return null;
  }
}

export function writeRuntimeConfigFile(cfg: SatelliteRuntimeConfig): void {
  const filePath = runtimeConfigFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}

function hydrateFromFileOnce(): void {
  if (fileHydrated) return;
  fileHydrated = true;
  const fromFile = readConfigFile();
  if (fromFile && Object.keys(fromFile).length) {
    const next = { ...getRuntimeConfigMemory(), ...fromFile };
    setRuntimeConfigMemory(next);
    applyEnvSideEffects(next);
  }
}

export function satelliteRuntimeConfig(): SatelliteRuntimeConfig {
  hydrateFromFileOnce();
  return { ...getRuntimeConfigMemory() };
}

export async function ensureRuntimeConfigTable(prisma: OrgBindPrisma): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${CONFIG_TABLE}" (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      "configJson" TEXT NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedBy" TEXT
    )
  `);
}

export async function loadRuntimeConfigFromDb(
  prisma: OrgBindPrisma,
): Promise<SatelliteRuntimeConfig | null> {
  try {
    await ensureRuntimeConfigTable(prisma);
    const rows = await prisma.$queryRawUnsafe<
      Array<{ configJson: string }>
    >(`SELECT "configJson" FROM "${CONFIG_TABLE}" WHERE id = 1 LIMIT 1`);
    const raw = rows[0]?.configJson;
    if (!raw) return null;
    return JSON.parse(raw) as SatelliteRuntimeConfig;
  } catch {
    return null;
  }
}

export async function saveRuntimeConfigToDb(
  prisma: OrgBindPrisma,
  cfg: SatelliteRuntimeConfig,
  updatedBy?: string,
): Promise<void> {
  await ensureRuntimeConfigTable(prisma);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${CONFIG_TABLE}" (id, "configJson", "updatedAt", "updatedBy")
     VALUES (1, $1, NOW(), $2)
     ON CONFLICT (id) DO UPDATE SET
       "configJson" = EXCLUDED."configJson",
       "updatedAt" = NOW(),
       "updatedBy" = EXCLUDED."updatedBy"`,
    JSON.stringify(cfg),
    updatedBy ?? null,
  );
}

export async function hydrateRuntimeConfigFromDb(
  prisma: OrgBindPrisma,
): Promise<SatelliteRuntimeConfig | null> {
  const cfg = await loadRuntimeConfigFromDb(prisma);
  if (cfg) {
    const next = { ...getRuntimeConfigMemory(), ...cfg };
    setRuntimeConfigMemory(next);
    applyEnvSideEffects(next);
  }
  return cfg;
}

export async function applySatelliteRuntimeConfig(opts: {
  config: SatelliteRuntimeConfig;
  updatedBy?: string;
  prisma?: OrgBindPrisma | null;
}): Promise<SatelliteRuntimeConfig> {
  const current = getRuntimeConfigMemory();
  const next: SatelliteRuntimeConfig = {
    ...current,
    ...opts.config,
    updatedAt: new Date().toISOString(),
    updatedBy: opts.updatedBy,
  };
  setRuntimeConfigMemory(next);
  applyEnvSideEffects(next);
  writeRuntimeConfigFile(next);
  if (opts.prisma) {
    await saveRuntimeConfigToDb(opts.prisma, next, opts.updatedBy);
  }
  return { ...next };
}

/** Merge boot: DB → file → memory. Call after onSatelliteBoot. */
export async function onSatelliteRuntimeBoot(opts: {
  prisma?: OrgBindPrisma | null;
}): Promise<SatelliteRuntimeConfig> {
  if (opts.prisma) {
    await hydrateRuntimeConfigFromDb(opts.prisma);
  }
  hydrateFromFileOnce();
  return satelliteRuntimeConfig();
}

export function resetRuntimeConfigForTests(): void {
  resetRuntimeConfigMemoryForTests();
  fileHydrated = false;
}

/** Safe view for GET (never echo SSO secret / event token). */
export function publicRuntimeConfigView(cfg: SatelliteRuntimeConfig): Record<string, unknown> {
  return {
    organizationId: cfg.organizationId ?? null,
    orchestratorEventUrl: cfg.orchestratorEventUrl ?? null,
    publicBaseUrl: cfg.publicBaseUrl ?? null,
    platformSuperAdminEmails: cfg.platformSuperAdminEmails ?? null,
    activeModules: Array.isArray(cfg.activeModules) ? cfg.activeModules : [],
    hotelModules: cfg.hotelModules ?? null,
    deploymentTopology: cfg.deploymentTopology ?? null,
    edition: cfg.edition ?? null,
    ssoSharedSecretConfigured: Boolean(cfg.ssoSharedSecret?.trim()),
    satelliteEventServiceTokenConfigured: Boolean(cfg.satelliteEventServiceToken?.trim()),
    updatedAt: cfg.updatedAt ?? null,
    updatedBy: cfg.updatedBy ?? null,
  };
}
