import { SatelliteOrganizationUnboundError } from "./organization-bind-runtime";

export class SatelliteTenantRawSqlError extends Error {
  readonly code = "TENANT_RAW_SQL_FORBIDDEN";

  constructor(message: string) {
    super(message);
    this.name = "SatelliteTenantRawSqlError";
  }
}

/**
 * Runtime satellites must not call `$queryRaw*` / `$executeRaw*` on tenant tables
 * without an explicit organizationId. Prisma cannot inject a WHERE into raw SQL.
 *
 * Pass the bound org and a tagged `Prisma.sql` fragment that already filters
 * `organization_id` / `"organizationId"`. This helper only asserts the id.
 */
export function assertTenantRawOrganizationId(organizationId: string): string {
  const id = organizationId?.trim() ?? "";
  if (!id || id === "unbound" || (id === "demo-org" && process.env.NODE_ENV === "production")) {
    throw new SatelliteOrganizationUnboundError(
      "organizationId is required for tenant-scoped raw SQL",
    );
  }
  return id;
}

const ORG_COLUMN_RE = /organization_id|"organizationId"|organizationId/i;

/** Fail closed if the SQL text does not mention an org column. */
export function assertTenantRawSqlMentionsOrg(sqlText: string): void {
  if (!ORG_COLUMN_RE.test(sqlText)) {
    throw new SatelliteTenantRawSqlError(
      "Raw SQL on a satellite must filter organization_id / organizationId",
    );
  }
}
