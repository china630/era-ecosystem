import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  clearLoginHostnameCacheForTests,
  lookupLoginHostname,
  normalizeLoginHostname,
  removeLoginHostnamesForOrg,
  resolveHostBoundLoginOrganizationId,
  resolveLoginHost,
  satelliteKeyFromEnv,
  upsertLoginHostname,
  type LoginHostnameEntry,
  type LoginHostnameKind,
} from "./login-hostname-memory";

export type { LoginHostnameEntry, LoginHostnameKind };

export type LoginHostnameSyncRow = {
  hostname: string;
  organizationId: string;
  satelliteKey?: string | null;
  kind?: LoginHostnameKind;
  status?: LoginHostnameEntry["status"];
};

export {
  clearLoginHostnameCacheForTests,
  lookupLoginHostname,
  resolveHostBoundLoginOrganizationId,
  resolveLoginHost,
  satelliteKeyFromEnv,
  upsertLoginHostname,
};

function mapFilePath(): string {
  return (
    process.env.ERA_LOGIN_HOSTNAMES_FILE?.trim() ||
    join(process.cwd(), ".data", "login-hostnames.json")
  );
}

function writeDiskMap(entries: Record<string, LoginHostnameEntry>): void {
  const path = mapFilePath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(entries, null, 0), "utf8");
}

function readDiskMap(): Record<string, LoginHostnameEntry> {
  const path = mapFilePath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, LoginHostnameEntry>;
  } catch {
    return {};
  }
}

export function hydrateLoginHostnameMapFromDisk(): void {
  const raw = readDiskMap();
  if (!raw || typeof raw !== "object") return;
  for (const [hostname, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.organizationId !== "string") continue;
    upsertLoginHostname(hostname, {
      organizationId: entry.organizationId,
      satelliteKey:
        typeof entry.satelliteKey === "string" ? entry.satelliteKey : null,
      kind: entry.kind === "portal" ? "portal" : "satellite_login",
      status:
        entry.status === "ACTIVE" ||
        entry.status === "PENDING_DNS" ||
        entry.status === "DISABLED"
          ? entry.status
          : "ACTIVE",
    });
  }
}

/** Replace all hostname rows for one org, then upsert Sync payload rows. */
export function mergeLoginHostnamesForOrg(
  organizationId: string,
  rows: readonly LoginHostnameSyncRow[],
): void {
  const orgId = organizationId.trim();
  removeLoginHostnamesForOrg(orgId);

  let disk = readDiskMap();
  for (const host of Object.keys(disk)) {
    if (disk[host]?.organizationId === orgId) {
      delete disk[host];
    }
  }

  for (const row of rows) {
    const hostname = normalizeLoginHostname(row.hostname);
    if (!hostname) continue;
    const entry: LoginHostnameEntry = {
      organizationId: orgId,
      satelliteKey: row.satelliteKey?.trim() || null,
      kind: row.kind === "portal" ? "portal" : "satellite_login",
      status: row.status ?? "ACTIVE",
    };
    upsertLoginHostname(hostname, entry);
    disk[hostname] = entry;
  }

  writeDiskMap(disk);
}
