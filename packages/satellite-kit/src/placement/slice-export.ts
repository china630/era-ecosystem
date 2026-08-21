/**
 * Org-slice export stub for PlacementJob (CP-PLACE-01).
 * Full DB dump / import is not implemented — metadata only for API honesty.
 */

export type OrgSliceExportResult = {
  organizationId: string;
  tables: string[];
  note: string;
};

/**
 * Returns metadata describing what a future slice exporter would cover.
 * Does not read or dump any database.
 */
export function exportOrgSlice(input: {
  organizationId: string;
}): OrgSliceExportResult {
  return {
    organizationId: input.organizationId,
    tables: [
      "tenant_ops_rows",
      "satellite_audit_log",
      "object_storage_prefix",
    ],
    note: "not implemented full dump",
  };
}
