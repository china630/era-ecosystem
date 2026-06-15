#!/usr/bin/env node
/**
 * Audit replay — compare journal trial balance vs EOD snapshot for a business date.
 * Exit 0 only when Σ Dr = Σ Cr and EOD run is COMPLETED (if present).
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
const bankOrgId = process.env.ERA_BANK_ORGANIZATION_ID ?? "demo-bank-org-001";
const businessDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);

if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

async function main() {
  const client = await pool.connect();
  try {
    const entries = await client.query(
      `SELECT COALESCE(SUM(debit_minor),0) AS dr, COALESCE(SUM(credit_minor),0) AS cr
       FROM journal_entries je
       JOIN journal_transactions jt ON jt.id = je.transaction_id
       WHERE je.bank_org_id = $1 AND jt.status = 'POSTED'
         AND jt.booking_date::date <= $2::date`,
      [bankOrgId, businessDate],
    );
    const dr = BigInt(entries.rows[0].dr);
    const cr = BigInt(entries.rows[0].cr);
    const balanced = dr === cr;

    const eod = await client.query(
      `SELECT status, steps FROM eod_runs
       WHERE bank_org_id = $1 AND business_date = $2::date`,
      [bankOrgId, businessDate],
    );
    const eodRow = eod.rows[0];
    const eodOk = !eodRow || eodRow.status === "COMPLETED";

    console.log(
      JSON.stringify(
        {
          businessDate,
          totalDebit: dr.toString(),
          totalCredit: cr.toString(),
          balanced,
          eodStatus: eodRow?.status ?? "none",
          ok: balanced && eodOk,
        },
        null,
        2,
      ),
    );
    process.exit(balanced && eodOk ? 0 : 1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
