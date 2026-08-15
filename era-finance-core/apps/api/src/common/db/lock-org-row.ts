/**
 * SEC-FIN-02..07: row lock inside an open transaction to prevent double-post races.
 * Table name must be a fixed schema map constant (never user input).
 */
export async function lockOrgRowForUpdate(
  tx: {
    $queryRawUnsafe: <T = unknown>(
      query: string,
      ...values: unknown[]
    ) => Promise<T>;
  },
  table:
    | "cash_orders"
    | "advance_reports"
    | "payroll_runs"
    | "salary_registries"
    | "invoices",
  id: string,
  organizationId: string,
): Promise<{ id: string; status: string } | null> {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string; status: string }>>(
    `SELECT id::text AS id, status::text AS status
     FROM ${table}
     WHERE id = $1::uuid AND organization_id = $2::uuid
     FOR UPDATE`,
    id,
    organizationId,
  );
  return rows[0] ?? null;
}
