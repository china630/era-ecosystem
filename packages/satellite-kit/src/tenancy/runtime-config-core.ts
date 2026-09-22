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
import { isFolkloreS2sToken } from "./folklore-s2s-token";

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

function compactDefined(cfg: SatelliteRuntimeConfig): SatelliteRuntimeConfig {
  const next: SatelliteRuntimeConfig = {};
  for (const [key, value] of Object.entries(cfg) as Array<
    [keyof SatelliteRuntimeConfig, SatelliteRuntimeConfig[keyof SatelliteRuntimeConfig]]
  >) {
    if (value !== undefined) {
      (next as Record<string, unknown>)[key as string] = value;
    }
  }
  return next;
}

function stripFolkloreSecrets(
  cfg: SatelliteRuntimeConfig,
  preserve?: SatelliteRuntimeConfig,
): SatelliteRuntimeConfig {
  const next = { ...cfg };
  if (isFolkloreS2sToken(next.satelliteEventServiceToken)) {
    const keep = preserve?.satelliteEventServiceToken;
    if (keep && !isFolkloreS2sToken(keep)) next.satelliteEventServiceToken = keep;
    else delete next.satelliteEventServiceToken;
  }
  if (isFolkloreS2sToken(next.ssoSharedSecret)) {
    const keep = preserve?.ssoSharedSecret;
    if (keep && !isFolkloreS2sToken(keep)) next.ssoSharedSecret = keep;
    else delete next.ssoSharedSecret;
  }
  return next;
}

function hydrateFromFileOnce(): void {
  if (fileHydrated) return;
  fileHydrated = true;
  const fromFile = readConfigFile();
  if (fromFile && Object.keys(fromFile).length) {
    const current = getRuntimeConfigMemory();
    const next = stripFolkloreSecrets({ ...current, ...fromFile }, current);
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
    const parsed = JSON.parse(raw) as SatelliteRuntimeConfig;
    return stripFolkloreSecrets(parsed, getRuntimeConfigMemory());
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
    const current = getRuntimeConfigMemory();
    const next = stripFolkloreSecrets({ ...current, ...cfg }, current);
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
  const next: SatelliteRuntimeConfig = stripFolkloreSecrets(
    {
      ...current,
      ...compactDefined(opts.config),
      updatedAt: new Date().toISOString(),
      updatedBy: opts.updatedBy,
    },
    current,
  );
  setRuntimeConfigMemory(next);
  applyEnvSideEffects(next);
  writeRuntimeConfigFile(next);
  if (opts.prisma) {
    await saveRuntimeConfigToDb(opts.prisma, next, opts.updatedBy);
  }
  return { ...next };
}

/** Merge boot: file cache first, then DB wins (stale `.data/runtime-config.json` must not clobber Sync). */
export async function onSatelliteRuntimeBoot(opts: {
  prisma?: OrgBindPrisma | null;
}): Promise<SatelliteRuntimeConfig> {
  hydrateFromFileOnce();
  if (opts.prisma) {
    await hydrateRuntimeConfigFromDb(opts.prisma);
  }
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
    vendorBridgesEnabled:
      typeof cfg.vendorBridgesEnabled === "boolean" ? cfg.vendorBridgesEnabled : null,
    ssoSharedSecretConfigured: Boolean(cfg.ssoSharedSecret?.trim()),
    satelliteEventServiceTokenConfigured: Boolean(cfg.satelliteEventServiceToken?.trim()),
    desiredStateHash: cfg.desiredStateHash ?? null,
    pulledAt: cfg.pulledAt ?? null,
    updatedAt: cfg.updatedAt ?? null,
    updatedBy: cfg.updatedBy ?? null,
  };
}
