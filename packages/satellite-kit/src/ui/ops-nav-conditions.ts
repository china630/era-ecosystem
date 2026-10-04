/** Signed-in person from one `GET /api/auth/me` (or JWT claims). Satellites do not fetch this again for the shell. */
export type OpsNavProfile = {
  displayName: string;
  login: string;
  fullName: string | null;
  email: string | null;
  organizationName: string | null;
  role: string;
  permissions: string[];
  isOwner: boolean;
  isPlatformSuperAdmin: boolean;
  pin: boolean;
  /** Org edition when the satellite sends one (F&B `kafe` | `fnb`); otherwise null. */
  edition: string | null;
  /** Enabled presets (`enabledPresets`); empty when the satellite sends none. */
  presets: string[];
  /** Active paid modules (`activeModules`); empty when the satellite sends none. */
  modules: string[];
  /** The raw `/api/auth/me` body (unwrapped from `data`) for app-specific flags. */
  raw: Record<string, unknown>;
};

export type OpsNavStatus = "loading" | "ready" | "error";

/**
 * Optional row conditions. A row is visible when every condition it sets holds.
 * `preset` and `edition` match any of the listed values.
 */
export type OpsNavCondition = {
  permission?: string;
  anyPermission?: readonly string[];
  module?: string;
  preset?: string | readonly string[];
  edition?: string | readonly string[];
  /** App-computed flag from the same profile read (e.g. a vendor bridge switch). */
  when?: boolean;
};

export type OpsNavAllow =
  | ((permission: string, profile: OpsNavProfile) => boolean)
  | {
      permission?: (permission: string, profile: OpsNavProfile) => boolean;
      module?: (module: string, profile: OpsNavProfile) => boolean;
    };

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Builds the nav profile from a `/api/auth/me` body or from JWT claims (finance, control plane). */
export function opsNavProfileFromMe(data: unknown): OpsNavProfile | null {
  if (!data || typeof data !== "object") return null;
  const outer = data as Record<string, unknown>;
  const row =
    outer.data && typeof outer.data === "object" && !Array.isArray(outer.data)
      ? (outer.data as Record<string, unknown>)
      : outer;
  const fullName = text(row.fullName) || text(row.displayName);
  const login = text(row.login) || text(row.username);
  const email = text(row.email);
  const edition = text(row.edition);
  return {
    displayName: fullName || login || email,
    fullName: fullName || null,
    login,
    email: email || null,
    organizationName: typeof row.organizationName === "string" ? row.organizationName : null,
    role: typeof row.role === "string" ? row.role : "",
    permissions: strings(row.permissions),
    isOwner: row.isOwner === true,
    isPlatformSuperAdmin: row.isPlatformSuperAdmin === true || row.isSuperAdmin === true,
    pin: row.pin === true,
    edition: edition || null,
    presets: strings(row.enabledPresets ?? row.presets),
    modules: strings(row.activeModules ?? row.modules),
    raw: row,
  };
}

function anyOf(value: string | readonly string[] | undefined): readonly string[] | null {
  if (value === undefined) return null;
  return typeof value === "string" ? [value] : value;
}

/** True when the row sets at least one condition. */
export function opsNavRowGated(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const c = row as OpsNavCondition;
  return (
    Boolean(c.permission) ||
    (c.anyPermission?.length ?? 0) > 0 ||
    Boolean(c.module) ||
    c.preset !== undefined ||
    c.edition !== undefined ||
    c.when !== undefined
  );
}

/** A row is visible when every condition it sets holds for this profile. */
export function opsNavRowVisible(
  row: OpsNavCondition,
  profile: OpsNavProfile,
  allow?: OpsNavAllow,
): boolean {
  const permissionAllow =
    typeof allow === "function"
      ? allow
      : (allow?.permission ?? ((p: string, pr: OpsNavProfile) => pr.permissions.includes(p)));
  const moduleAllow =
    typeof allow === "object" && allow?.module
      ? allow.module
      : (m: string, pr: OpsNavProfile) => pr.modules.includes(m);

  if (row.when === false) return false;
  if (row.permission && !permissionAllow(row.permission, profile)) return false;
  if (row.anyPermission && row.anyPermission.length > 0) {
    if (!row.anyPermission.some((p) => permissionAllow(p, profile))) return false;
  }
  if (row.module && !moduleAllow(row.module, profile)) return false;
  const presets = anyOf(row.preset);
  if (presets && !presets.some((p) => profile.presets.includes(p))) return false;
  const editions = anyOf(row.edition);
  if (editions && !(profile.edition && editions.includes(profile.edition))) return false;
  return true;
}

/**
 * A catalog with any row condition stays empty until the profile is ready, then the allowed set once.
 * A catalog with no conditions is the full list and is returned immediately so static shells do not flicker.
 * A failed gated read does not substitute a shorter menu and does not show every link.
 */
export function visibleOpsNavItems<T>(
  items: readonly T[],
  status: OpsNavStatus,
  profile: OpsNavProfile | null,
  allow?: OpsNavAllow,
): T[] {
  const gated = items.some((item) => opsNavRowGated(item));
  if (!gated) return [...items];
  if (status !== "ready" || !profile) return [];
  return items.filter(
    (item) => !opsNavRowGated(item) || opsNavRowVisible(item as OpsNavCondition, profile, allow),
  );
}

function filterNavBranch<T>(
  item: T,
  profile: OpsNavProfile,
  allow?: OpsNavAllow,
): T | null {
  if (opsNavRowGated(item) && !opsNavRowVisible(item as OpsNavCondition, profile, allow)) {
    return null;
  }
  const children = (item as { children?: readonly unknown[]; href?: string }).children;
  if (!children) return item;
  const next = children
    .map((child) => filterNavBranch(child, profile, allow))
    .filter((child): child is NonNullable<typeof child> => child != null);
  if (next.length === 0 && !(item as { href?: string }).href) return null;
  return { ...(item as object), children: next } as T;
}

/**
 * Same rule for sectioned menus. The section's own conditions apply to all its rows;
 * a section left without rows is dropped. Sections without rows (headers) pass when ungated.
 * Nested `children` are filtered with the same rule; a parent with no href and no visible children is dropped.
 */
export function visibleOpsNavSections<S extends { items: readonly unknown[] }>(
  sections: readonly S[],
  status: OpsNavStatus,
  profile: OpsNavProfile | null,
  allow?: OpsNavAllow,
): S[] {
  const gated = sections.some(
    (section) => opsNavRowGated(section) || section.items.some((item) => opsNavRowGated(item)),
  );
  if (!gated) return [...sections];
  if (status !== "ready" || !profile) return [];
  const out: S[] = [];
  for (const section of sections) {
    if (opsNavRowGated(section) && !opsNavRowVisible(section as OpsNavCondition, profile, allow)) {
      continue;
    }
    const items = section.items
      .map((item) => filterNavBranch(item, profile, allow))
      .filter((item): item is (typeof section.items)[number] => item != null);
    if (section.items.length > 0 && items.length === 0) continue;
    out.push({ ...section, items });
  }
  return out;
}
