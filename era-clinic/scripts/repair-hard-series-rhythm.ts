/**
 * Repair OPEN hard day-series courses with working-day streak > mode baths.
 *
 *   cd era-clinic
 *   DATABASE_URL=... npx tsx scripts/repair-hard-series-rhythm.ts --dry-run
 *   DATABASE_URL=... npx tsx scripts/repair-hard-series-rhythm.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import {
  hardSeriesMaxWorkingStreak,
  illegalHardSeriesBathYmds,
  planBathSeries,
  type StayDay,
} from "../src/domain/planning/bath-calendar";
import { addBakuDays, todayBakuYmd } from "../src/lib/baku-day";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

function bakuDow(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m! - 1, d)).getUTCDay();
}

async function main() {
  const hardRows = await prisma.procedureDaySeriesMember.findMany({
    where: { series: { active: true, fillsRestDays: false } },
    select: { procedureCode: true },
  });
  const hardCodes = [...new Set(hardRows.map((r) => r.procedureCode))];
  if (hardCodes.length === 0) {
    console.log("No hard series members");
    return;
  }

  const tenant = await prisma.tenant.findFirst({
    select: { closedWeekdays: true },
    orderBy: { id: "asc" },
  });
  const closedWeekdays = new Set(tenant?.closedWeekdays?.length ? tenant.closedWeekdays : [0]);
  const overrides = await prisma.clinicDayOverride.findMany({
    select: { dayYmd: true, dayKind: true },
  });
  const ov = new Map(overrides.map((r) => [r.dayYmd, r.dayKind]));

  function isWorking(ymd: string): boolean {
    const kind = ov.get(ymd);
    if (kind === "CLOSED") return false;
    if (kind === "WORKING" || kind === "SHORT") return true;
    return !closedWeekdays.has(bakuDow(ymd));
  }

  const orders = await prisma.procedureOrder.findMany({
    where: {
      status: { in: ["SCHEDULED", "PROPOSED", "CHECKED_IN", "COMPLETED"] },
      procedureCode: { in: hardCodes },
      clinicalEpisode: { status: "OPEN" },
    },
    select: {
      id: true,
      procedureCode: true,
      status: true,
      scheduledAt: true,
      physioFields: true,
      clinicalEpisodeId: true,
      clinicalEpisode: {
        select: {
          roomNumber: true,
          patientRef: { select: { refCode: true, fullName: true } },
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const byKey = new Map<
    string,
    {
      episodeId: string;
      procedureCode: string;
      patientCode: string;
      patientName: string;
      room: string;
      rows: typeof orders;
    }
  >();
  for (const row of orders) {
    if (!row.clinicalEpisodeId) continue;
    const key = `${row.clinicalEpisodeId}|${row.procedureCode}`;
    const g = byKey.get(key) ?? {
      episodeId: row.clinicalEpisodeId,
      procedureCode: row.procedureCode,
      patientCode: row.clinicalEpisode?.patientRef?.refCode ?? "?",
      patientName: row.clinicalEpisode?.patientRef?.fullName ?? "?",
      room: row.clinicalEpisode?.roomNumber ?? "",
      rows: [],
    };
    g.rows.push(row);
    byKey.set(key, g);
  }

  const today = todayBakuYmd();
  let touched = 0;
  let skipped = 0;

  for (const g of byKey.values()) {
    const ymds = [
      ...new Set(
        g.rows.map((r) =>
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Baku",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(r.scheduledAt),
        ),
      ),
    ].sort();
    const from = ymds[0]!;
    const to = addBakuDays(ymds[ymds.length - 1]!, 21);
    const days: StayDay[] = [];
    for (let y = from; y <= to; y = addBakuDays(y, 1)) {
      days.push({ ymd: y, working: isWorking(y) });
    }
    const modeRaw = g.rows[0]?.physioFields;
    const mode =
      modeRaw && typeof modeRaw === "object" && !Array.isArray(modeRaw)
        ? String((modeRaw as { dayBlock?: unknown }).dayBlock ?? "3").toUpperCase()
        : "3";
    const streak = hardSeriesMaxWorkingStreak(ymds, days);
    const illegal = illegalHardSeriesBathYmds({ bathYmds: ymds, days, mode });
    const futureIllegal = illegal.filter((ymd) => ymd >= today);
    if (streak < 4 && futureIllegal.length === 0) {
      skipped += 1;
      continue;
    }

    const bakuOf = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Baku",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);

    const locked = g.rows.filter(
      (r) => r.status === "CHECKED_IN" || r.status === "COMPLETED" || bakuOf(r.scheduledAt) < today,
    );
    const movable = g.rows
      .filter((r) => !locked.includes(r))
      .sort((a, b) => bakuOf(a.scheduledAt).localeCompare(bakuOf(b.scheduledAt)) || a.id.localeCompare(b.id));
    if (movable.length === 0) {
      skipped += 1;
      continue;
    }

    const kept = locked.map((r) => ({
      ymd: bakuOf(r.scheduledAt),
      procedureCode: g.procedureCode,
      locked: true as const,
    }));

    let planned = planBathSeries({
      days,
      series: [
        {
          seriesCode: "HARD",
          procedureCode: g.procedureCode,
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
    let assignYmds = planned.filter((c) => !c.locked && c.ymd >= today).map((c) => c.ymd);
    if (assignYmds.length < movable.length) {
      planned = planBathSeries({
        days,
        series: [
          {
            seriesCode: "HARD",
            procedureCode: g.procedureCode,
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
      assignYmds = planned.filter((c) => !c.locked && c.ymd >= today).map((c) => c.ymd);
    }

    const afterYmds = [...kept.map((k) => k.ymd), ...assignYmds.slice(0, movable.length)].sort();
    if (ymds.join(",") === afterYmds.join(",")) {
      skipped += 1;
      continue;
    }

    console.log(`\n${g.patientCode} | ${g.patientName} | room ${g.room} | ${g.procedureCode}`);
    console.log(`  before: ${ymds.join(",")} (streak ${streak})`);
    console.log(`  after:  ${afterYmds.join(",") || "(none)"}`);

    if (!apply) {
      touched += 1;
      continue;
    }

    for (let i = 0; i < movable.length; i++) {
      const order = movable[i]!;
      const ymd = assignYmds[i];
      await prisma.procedureAllocation.deleteMany({ where: { procedureOrderId: order.id } });
      const prev =
        order.physioFields && typeof order.physioFields === "object" && !Array.isArray(order.physioFields)
          ? (order.physioFields as Record<string, unknown>)
          : {};
      if (!ymd) {
        await prisma.procedureOrder.update({
          where: { id: order.id },
          data: { status: "PROPOSED", resourceId: null },
        });
        continue;
      }
      const scheduledAt = new Date(`${ymd}T05:00:00.000Z`); // 09:00 Asia/Baku
      await prisma.procedureOrder.update({
        where: { id: order.id },
        data: {
          status: "PROPOSED",
          resourceId: null,
          scheduledAt,
          physioFields: { ...prev, dayBlock: mode },
        },
      });
    }
    touched += 1;
  }

  console.log(
    `\nDone. ${apply ? "Applied" : "Dry-run"} courses: ${touched}; clean skipped: ${skipped}`,
  );
  if (apply) {
    console.log("PROPOSED rows need Saxla / schedule-reseat for cabins.");
  } else {
    console.log("Re-run with --apply to write.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
