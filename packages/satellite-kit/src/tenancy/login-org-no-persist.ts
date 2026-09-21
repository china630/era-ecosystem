import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { upsertLoginOrgNo, removeLoginOrgNosForOrganizationId } from "../auth/resolve-login-org";

/**
 * Mergeable orgNo → UUID map persistence (A4).
 * SHARED Sync must not last-write-wins a single organizationId — this file
 * accumulates entries across Sync fan-outs.
 */

function mapFilePath(): string {
  return (
    process.env.ERA_ORG_PUBLIC_NUMBERS_FILE?.trim() ||
    join(process.cwd(), ".data", "org-public-numbers.json")
  );
}

type DiskMap = Record<string, string>;

export function hydrateLoginOrgNoMapFromDisk(): void {
  const path = mapFilePath();
  if (!existsSync(path)) return;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as DiskMap;
    if (!raw || typeof raw !== "object") return;
    for (const [orgNo, organizationId] of Object.entries(raw)) {
      if (/^[1-9][0-9]{5}$/.test(orgNo) && typeof organizationId === "string") {
        upsertLoginOrgNo(orgNo, organizationId);
      }
    }
  } catch {
    /* ignore corrupt cache */
  }
}

/** Upsert one mapping and persist mergeably to disk. */
export function mergeLoginOrgNoPersistent(
  orgNo: number | string,
  organizationId: string,
): void {
  upsertLoginOrgNo(orgNo, organizationId);
  const path = mapFilePath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  let existing: DiskMap = {};
  if (existsSync(path)) {
    try {
      existing = JSON.parse(readFileSync(path, "utf8")) as DiskMap;
    } catch {
      existing = {};
    }
  }
  existing[String(orgNo).trim()] = organizationId.trim();
  writeFileSync(path, JSON.stringify(existing, null, 0), "utf8");
}

/** Drop all orgNo rows for a soft-deleted / revoked organization. */
export function pruneLoginOrgNoPersistent(organizationId: string): void {
  removeLoginOrgNosForOrganizationId(organizationId);
  const path = mapFilePath();
  if (!existsSync(path)) return;
  let existing: DiskMap = {};
  try {
    existing = JSON.parse(readFileSync(path, "utf8")) as DiskMap;
  } catch {
    return;
  }
  const orgId = organizationId.trim();
  const next: DiskMap = {};
  for (const [orgNo, mapped] of Object.entries(existing)) {
    if (mapped !== orgId) next[orgNo] = mapped;
  }
  writeFileSync(path, JSON.stringify(next, null, 0), "utf8");
}
