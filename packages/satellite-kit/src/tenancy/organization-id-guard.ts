/** Values that must never be stored as a tenant organizationId. */
export const SENTINEL_ORGANIZATION_IDS = ["unbound", "demo-org"] as const;

export class TenantOrganizationMismatchError extends Error {
  readonly code = "TENANT_ORG_MISMATCH";
  readonly attempted: string;
  readonly expected: string;

  constructor(attempted: string, expected: string) {
    super(
      `Refusing write with organizationId=${attempted}; tenant context is ${expected}`,
    );
    this.name = "TenantOrganizationMismatchError";
    this.attempted = attempted;
    this.expected = expected;
  }
}

export function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * `unbound` is never a tenant. `demo-org` is allowed only outside production
 * (local smoke). Production env/bind of `demo-org` is treated as unbound.
 */
export function isSentinelOrganizationId(
  id: string | null | undefined,
  opts?: { production?: boolean },
): boolean {
  const v = id?.trim() ?? "";
  if (!v) return true;
  if (v === "unbound") return true;
  const production = opts?.production ?? isProductionNodeEnv();
  if (v === "demo-org" && production) return true;
  return false;
}

/** Stamp create/upsert data; reject a client-supplied org that does not match context. */
export function stampTenantCreateData(
  data: Record<string, unknown>,
  orgId: string,
): Record<string, unknown> {
  const explicit = data.organizationId;
  if (typeof explicit === "string" && explicit.length > 0 && explicit !== orgId) {
    throw new TenantOrganizationMismatchError(explicit, orgId);
  }
  return { ...data, organizationId: orgId };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    v != null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    !(v instanceof Date) &&
    !(v instanceof Uint8Array)
  );
}

/**
 * Stamp a Prisma create / createMany / upsert.create payload, including nested
 * `create` / `createMany.data` / `connectOrCreate.create` trees.
 * Relation wrappers (`connect`, `disconnect`, `set`, `update`, `delete`) are not stamped.
 */
export function stampTenantCreateTree(data: unknown, orgId: string): unknown {
  if (data == null) return data;
  if (Array.isArray(data)) {
    return data.map((row) => stampTenantCreateTree(row, orgId));
  }
  if (!isPlainObject(data)) return data;
  return stampCreateRow(data, orgId);
}

function stampCreateRow(
  row: Record<string, unknown>,
  orgId: string,
): Record<string, unknown> {
  const stamped = stampTenantCreateData({ ...row }, orgId);
  const out: Record<string, unknown> = { ...stamped };
  for (const [key, value] of Object.entries(out)) {
    if (key === "organizationId") continue;
    if (isPlainObject(value) && looksLikeRelationNestedWrite(value)) {
      out[key] = stampRelationNestedWrite(value, orgId);
    }
  }
  return out;
}

function looksLikeRelationNestedWrite(v: Record<string, unknown>): boolean {
  return (
    "create" in v ||
    "createMany" in v ||
    "connectOrCreate" in v
  );
}

function stampRelationNestedWrite(
  value: Record<string, unknown>,
  orgId: string,
): Record<string, unknown> {
  const out = { ...value };
  if ("create" in out) {
    out.create = stampTenantCreateTree(out.create, orgId);
  }
  if ("createMany" in out && isPlainObject(out.createMany)) {
    const cm = { ...out.createMany };
    if ("data" in cm) {
      cm.data = stampTenantCreateTree(cm.data, orgId);
    }
    out.createMany = cm;
  }
  if ("connectOrCreate" in out) {
    out.connectOrCreate = stampConnectOrCreate(out.connectOrCreate, orgId);
  }
  return out;
}

function stampConnectOrCreate(value: unknown, orgId: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stampConnectOrCreate(item, orgId));
  }
  if (!isPlainObject(value)) return value;
  if (!("create" in value)) return value;
  return {
    ...value,
    create: stampTenantCreateTree(value.create, orgId),
  };
}
