/**
 * Repair OPEN hard day-series courses whose working-day bath streak exceeds mode.baths.
 *
 * Usage (from repo root, against droplet DB via tunnel or direct URL):
 *   DATABASE_URL=postgresql://... node scripts/repair-hard-series-rhythm.mjs --dry-run
 *   DATABASE_URL=postgresql://... node scripts/repair-hard-series-rhythm.mjs --apply
 *
 * On droplet (compose network):
 *   docker exec -e DATABASE_URL=... -i era-clinic node - < scripts/repair-hard-series-rhythm.mjs --apply
 *
 * Does not touch CHECKED_IN / COMPLETED. Future SCHEDULED/PROPOSED hard baths are
 * re-laid with mode rest (continue from locked past). Allocations on moved rows are dropped.
 */
import pg from "pg";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const apply = process.argv.includes("--apply");
const dryRun = !apply;

async function loadPlanner() {
  // Prefer compiled/ts via tsx register when available; else dynamic import of source through tsx.
  try {
    const mod = await import(
      pathToFileURL(join(__dirname, "../era-clinic/src/domain/planning/bath-calendar.ts")).href
    );
    return mod;
  } catch {
    const { register } = await import("node:module");
    // fall through — expect runner: npx tsx scripts/repair-hard-series-rhythm.mjs
    throw new Error("Run with: npx tsx scripts/repair-hard-series-rhythm.mjs [--dry-run|--apply]");
  }
}

function addDaysYmd(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function bakuDow(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function todayBakuYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const { planBathSeries, hardSeriesMaxWorkingStreak, illegalHardSeriesBathYmds } =
    await import(
      pathToFileURL(join(__dirname, "../era-clinic/src/domain/planning/bath-calendar.ts")).href
    ).catch(async () => {
      console.error("Import bath-calendar.ts failed — use: npx tsx scripts/repair-hard-series-rhythm.mjs");
      process.exit(1);
    });

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const hard = await client.query(`
    SELECT m.procedure_code AS code
    FROM procedure_day_series_member m
    JOIN procedure_day_series s ON s.id = m.series_id
    WHERE s.active = true AND s.fills_rest_days = false
  `);
  const hardCodes = hard.rows.map((r) => r.code);
  if (hardCodes.length === 0) {
    console.log("No hard series members");
    await client.end();
    return;
  }

  const closedRes = await client.query(
    `SELECT coalesce(closed_weekdays, '{0}') AS w FROM "Tenant" ORDER BY id LIMIT 1`,
  );
  const closedWeekdays = new Set((closedRes.rows[0]?.w || [0]).map(Number));

  const ov = await client.query(`SELECT day_ymd, day_kind::text FROM clinic_day_override`);
  const overrides = new Map(ov.rows.map((r) => [r.day_ymd, r.day_kind]));

  function isWorking(ymd) {
    const o = overrides.get(ymd);
    if (o === "CLOSED") return false;
    if (o === "WORKING" || o === "SHORT") return true;
    return !closedWeekdays.has(bakuDow(ymd));
  }

  const baths = await client.query(
    `
    SELECT e.id AS episode_id,
           p."refCode" AS patient_code,
           p."fullName" AS patient_name,
           coalesce(e."roomNumber",'') AS room,
           o.id AS order_id,
           o."procedureCode" AS procedure_code,
           o.status::text AS status,
           (o."scheduledAt" AT TIME ZONE 'Asia/Baku')::date::text AS baku,
           coalesce(o.physio_fields->>'dayBlock', '3') AS mode
    FROM "ProcedureOrder" o
    JOIN "ClinicalEpisode" e ON e.id = o.clinical_episode_id
    JOIN "PatientRef" p ON p.id = e."patientRefId"
    WHERE e.status = 'OPEN'
      AND o.status::text IN ('SCHEDULED','PROPOSED','CHECKED_IN','COMPLETED')
      AND o."procedureCode" = ANY($1::text[])
    ORDER BY e.id, o."procedureCode", baku
  `,
    [hardCodes],
  );

  const byKey = new Map();
  for (const row of baths.rows) {
    const key = `${row.episode_id}|${row.procedure_code}`;
    const g = byKey.get(key) ?? { ...row, orders: [] };
    g.orders.push(row);
    byKey.set(key, g);
  }

  const today = todayBakuYmd();
  let fixed = 0;
  let skipped = 0;

  for (const g of byKey.values()) {
    const ymds = [...new Set(g.orders.map((o) => o.baku))].sort();
    const from = ymds[0];
    const to = addDaysYmd(ymds[ymds.length - 1], 14);
    const days = [];
    for (let y = from; y <= to; y = addDaysYmd(y, 1)) {
      days.push({ ymd: y, working: isWorking(y) });
    }
    const streak = hardSeriesMaxWorkingStreak(ymds, days);
    const mode = String(g.orders[0]?.mode || "3").toUpperCase();
    const illegal = illegalHardSeriesBathYmds({ bathYmds: ymds, days, mode });
    if (streak < 4 && illegal.length === 0) {
      skipped += 1;
      continue;
    }

    const locked = g.orders.filter(
      (o) => o.status === "CHECKED_IN" || o.status === "COMPLETED" || o.baku < today,
    );
    const movable = g.orders.filter((o) => !locked.includes(o));
    if (movable.length === 0) {
      console.log(`SKIP ${g.patient_code} ${g.procedure_code} — nothing movable`);
      skipped += 1;
      continue;
    }

    const kept = locked.map((o) => ({
      ymd: o.baku,
      procedureCode: o.procedure_code,
      locked: true,
    }));
    const planned = planBathSeries({
      days,
      series: [
        {
          seriesCode: "HARD",
          procedureCode: g.procedure_code,
          mark: "·",
          mode,
          qty: locked.length + movable.length,
          fillsRestDays: false,
          weeklyCap: 5,
        },
      ],
      kept,
      layout: locked.length ? "continue" : "fresh",
      notBeforeYmd: today,
    });
    const newCells = planned.filter((c) => !c.locked).map((c) => c.ymd);
    // If continue cannot place enough (broken past block), fresh-replan all movable from today
    let assignYmds = newCells;
    if (assignYmds.length < movable.length) {
      const fresh = planBathSeries({
        days,
        series: [
          {
            seriesCode: "HARD",
            procedureCode: g.procedure_code,
            mark: "·",
            mode,
            qty: locked.length + movable.length,
            fillsRestDays: false,
            weeklyCap: 5,
          },
        ],
        kept,
        layout: "fresh",
        notBeforeYmd: today,
      });
      assignYmds = fresh.filter((c) => !c.locked && c.ymd >= today).map((c) => c.ymd);
    }

    console.log(
      `\n${g.patient_code} | ${g.patient_name} | room ${g.room} | ${g.procedure_code}`,
    );
    console.log(`  before: ${ymds.join(",")} (streak ${streak})`);
    console.log(`  after new pins: ${assignYmds.join(",") || "(none)"}`);

    if (dryRun) {
      fixed += 1;
      continue;
    }

    // Drop cabin allocations for movable; retime to planned days (day start 09:00 Baku ≈ 05:00 UTC)
    for (let i = 0; i < movable.length; i++) {
      const order = movable[i];
      const ymd = assignYmds[i];
      await client.query(`DELETE FROM procedure_allocation WHERE procedure_order_id = $1`, [
        order.order_id,
      ]);
      if (!ymd) {
        // No legal day — leave PROPOSED at day-start of previous date for ops to see
        await client.query(
          `UPDATE "ProcedureOrder" SET status = 'PROPOSED', "resourceId" = NULL,
           "scheduledAt" = (("scheduledAt" AT TIME ZONE 'Asia/Baku')::date::text || ' 09:00:00')::timestamp AT TIME ZONE 'Asia/Baku'
           WHERE id = $1`,
          [order.order_id],
        );
        continue;
      }
      await client.query(
        `UPDATE "ProcedureOrder"
         SET status = 'PROPOSED',
             "resourceId" = NULL,
             "scheduledAt" = ($2 || ' 09:00:00')::timestamp AT TIME ZONE 'Asia/Baku',
             physio_fields = coalesce(physio_fields, '{}'::jsonb) || jsonb_build_object('dayBlock', $3::text)
         WHERE id = $1`,
        [order.order_id, ymd, mode],
      );
    }
    fixed += 1;
  }

  console.log(`\nDone. ${dryRun ? "Dry-run" : "Applied"} courses touched: ${fixed}; ok skipped: ${skipped}`);
  console.log(
    dryRun
      ? "Re-run with --apply to write. Then Saxla/reseat cabins for PROPOSED rows."
      : "Movable hard baths are PROPOSED without cabin — run Saxla or schedule-reseat per episode.",
  );
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
