import { BODY_PART_CODES } from "@/lib/body-part-codes";

export class PhysioCatalogError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PhysioCatalogError";
    this.status = status;
  }
}

export const PHYSIO_SITE_KINDS = ["USSR-817", "SHCHERBAK", "HYDRO", "LOCAL"] as const;
export type PhysioSiteKind = (typeof PHYSIO_SITE_KINDS)[number];

export const PHYSIO_LIST_KINDS = ["DEVICE_PROGRAM", "SUBSTANCE"] as const;
export type PhysioListKindCode = (typeof PHYSIO_LIST_KINDS)[number];

export const PHYSIO_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{0,62}$/;

export function normalizePhysioCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Fold WO alias for unique storage / search (trim, collapse space, lower). */
export function normalizePhysioAlias(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toLowerCase();
}

export function isPhysioSiteKind(raw: string): raw is PhysioSiteKind {
  return (PHYSIO_SITE_KINDS as readonly string[]).includes(raw);
}

export function isPhysioListKind(raw: string): raw is PhysioListKindCode {
  return (PHYSIO_LIST_KINDS as readonly string[]).includes(raw);
}

export function assertPhysioCode(code: string): string {
  const normalized = normalizePhysioCode(code);
  if (!PHYSIO_CODE_RE.test(normalized)) {
    throw new PhysioCatalogError("Invalid catalog code");
  }
  return normalized;
}

export function parseSiteKind(kind: string): PhysioSiteKind {
  const raw = kind.trim();
  if (isPhysioSiteKind(raw)) return raw;
  throw new PhysioCatalogError("Unknown site kind");
}

export function parseCoarse(codes: string[]): string[] {
  const allowed = new Set<string>(BODY_PART_CODES);
  const out: string[] = [];
  for (const c of codes) {
    const code = c.trim().toUpperCase();
    if (!code) continue;
    if (!allowed.has(code)) {
      throw new PhysioCatalogError(`Unknown coarse body part: ${code}`);
    }
    if (!out.includes(code)) out.push(code);
  }
  if (out.length === 0) {
    throw new PhysioCatalogError("At least one coarse BODY_PART is required");
  }
  return out;
}

export function parseAliasList(raw: string[] | undefined): string[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const alias = normalizePhysioAlias(item);
    if (!alias || seen.has(alias)) continue;
    seen.add(alias);
    out.push(alias);
  }
  return out;
}
