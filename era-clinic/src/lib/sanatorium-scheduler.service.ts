import { prisma } from "@/lib/prisma";
import {
  nightsBetween,
  quotaFor,
  applyQuotaRecalc,
  clampStayNights,
  dailyRateQuotaTotal,
  weeklyQuotaTotal,
  resolveQuotaMode,
  resolveBlockQuotaMode,
  defaultBlockQuotaMode,
  asQuotaRate,
} from "@/lib/program-quota";
import { addBakuDays, bakuDateKey, bakuHourMinute, parseBakuDateTime } from "@/lib/baku-day";
import {
  buildEntitlementSnapshot,
  findCurrentProgramTemplate,
  programTemplateInclude,
} from "@/domain/sanatorium/program-template-admin";
import { releaseProcedureOccupancy } from "@/domain/procedure/procedure-allocation.service";
import { resolveDailyDistinctCap } from "@/domain/sanatorium/daily-package-cap";

export async function instantiateProgramFromTemplate(input: {
  episodeId: string;
  programCode: string;
  reservationId?: string;
  startsOn: Date;
  /** Hotel check-out — Wave B endsOn + nights. */
  checkOutDate?: Date;
  checkInDate?: Date;
  nights?: number;
}) {
  const template = await findCurrentProgramTemplate(input.programCode);
  if (!template) throw new Error(`Program template ${input.programCode} not found`);

  let checkIn = input.checkInDate ?? input.startsOn;
  let hotelOut: Date | undefined;
  if (input.reservationId) {
    const { lookupHotelStayWindow } = await import("@/lib/hotel-stay-person");
    const hotel = await lookupHotelStayWindow(input.reservationId);
    if (hotel) {
      checkIn = new Date(hotel.checkInDate);
      hotelOut = new Date(hotel.checkOutDate);
    }
  }
  const checkOut =
    hotelOut ??
    input.checkOutDate ??
    (() => {
      const startYmd = bakuDateKey(input.startsOn);
      const { hour, minute } = bakuHourMinute(input.startsOn);
      const hh = String(hour).padStart(2, "0");
      const mm = String(minute).padStart(2, "0");
      return parseBakuDateTime(addBakuDays(startYmd, template.durationDays), `${hh}:${mm}`);
    })();
  const hotelNights = hotelOut ? nightsBetween(checkIn, hotelOut) : 0;
  const nights =
    hotelNights ||
    input.nights ||
    nightsBetween(checkIn, checkOut) ||
    template.durationDays;

  const endsOn = checkOut;

  const quotaMode = resolveQuotaMode(
    (template as { quotaMode?: string | null }).quotaMode,
  );
  const countSunday = Boolean((template as { countSunday?: boolean }).countSunday);
  const balanceRows = template.procedures.map(
    (p: {
      quotaTotal: number;
      procedureCode: string;
      kind?: string | null;
      quotaBasis?: string | null;
      blockQuotaMode?: string | null;
      quotaPerNight?: unknown;
      quotaPerWeek?: number | null;
    }) => {
    const quotaTotal = resolveBlockQuotaTotal({
      quotaMode,
      countSunday,
      nights,
      checkIn,
      endsOn,
      procedure: p,
      knots: template.quotaKnots,
      minNights: template.minNights,
      maxNights: template.maxNights,
    });
    return {
      procedureCode: p.procedureCode,
      quotaTotal,
      quotaUsed: 0,
    };
  });

  const entitlementSnapshot = buildEntitlementSnapshot({
    templateId: template.id,
    code: template.code,
    version: template.version,
    quotaMode: (template as { quotaMode?: string | null }).quotaMode,
    countSunday: (template as { countSunday?: boolean | null }).countSunday,
    procedures: template.procedures,
    knots: template.quotaKnots,
    members: template.blockMembers,
  });

  /**
   * ProgramProcedureBalance is not tenant-scoped. Nested `procedureLines.create`
   * under ProgramInstance is stamped with organizationId and rejected (same class
   * as LabOrderItem). Create instance first, then top-level balance rows.
   */
  const created = await prisma.programInstance.create({
    data: {
      templateId: template.id,
      episodeId: input.episodeId,
      reservationId: input.reservationId,
      programCode: template.code,
      startsOn: checkIn,
      endsOn,
      entitlementSnapshot,
    },
  });
  if (balanceRows.length > 0) {
    await prisma.programProcedureBalance.createMany({
      data: balanceRows.map(
        (row: { procedureCode: string; quotaTotal: number; quotaUsed: number }) => ({
        instanceId: created.id,
        procedureCode: row.procedureCode,
        quotaTotal: row.quotaTotal,
        quotaUsed: row.quotaUsed,
      })),
    });
  }
  const instance = await prisma.programInstance.findUniqueOrThrow({
    where: { id: created.id },
    include: { procedureLines: true },
  });

  // A package arrived, so a prior "guest has no package" confirmation is stale —
  // clearing it puts entitlement pricing back in charge of this episode.
  await prisma.clinicalEpisode.update({
    where: { id: input.episodeId },
    data: {
      programCode: template.code,
      noPackageConfirmedAt: null,
      noPackageConfirmedByUserId: null,
    },
  });

  // Studies (labs, imaging, auto visits) are created once the course exists.
  // A missing care-team doctor leaves visits in PENDING_DOCTOR; the first
  // doctor assignment retries. A failure here must not roll back the course.
  try {
    const { applyPackageAutoBlocks } = await import(
      "@/domain/sanatorium/package-auto-apply.service"
    );
    await applyPackageAutoBlocks(input.episodeId, { trigger: "CARE_TEAM" });
  } catch (err) {
    console.error("[program] auto studies failed", input.episodeId, err);
  }

  return instance;
}

/**
 * Recalculate balances after nights or package change.
 * Never decreases quotaUsed below consumed; does not cancel CHECKED_IN/COMPLETED.
 * Drops orphan PROPOSED for codes removed from the new package.
 * CLI-57: when endsOn shortens, cancel future SCHEDULED past the new end.
 *
 * Night-only recalc keeps pinned templateId + snapshot knots.
 * Explicit programCode change switches to the **current** template version and refreshes snapshot.
 */
/** Nights of the stay that are not Sunday in Asia/Baku. Checkout morning is not a night. */
export function nonSundayStayNights(startsOn: Date, endsOn: Date): number {
  return countStayNightsBaku(startsOn, endsOn, { includeSunday: false });
}

/** All stay nights in Asia/Baku (checkout morning excluded). */
export function stayNightsBaku(startsOn: Date, endsOn: Date): number {
  return countStayNightsBaku(startsOn, endsOn, { includeSunday: true });
}

function countStayNightsBaku(
  startsOn: Date,
  endsOn: Date,
  opts: { includeSunday: boolean },
): number {
  const from = bakuDateKey(startsOn);
  const to = bakuDateKey(endsOn);
  let count = 0;
  let ymd = from;
  for (let guard = 0; ymd < to && guard < 400; guard++) {
    const noon = parseBakuDateTime(ymd, "12:00");
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Baku",
      weekday: "short",
    }).format(noon);
    if (opts.includeSunday || weekday !== "Sun") count += 1;
    ymd = addBakuDays(ymd, 1);
  }
  return count;
}

/**
 * Counted nights for DAILY_RATE after min/max clamp.
 * When countSunday is false, only the first N clamped nights of the stay are walked
 * and Sundays among them are dropped.
 */
export function countedNightsForDailyRate(input: {
  startsOn: Date;
  endsOn: Date;
  nights: number;
  countSunday: boolean;
  minNights?: number | null;
  maxNights?: number | null;
}): number {
  const clamped = clampStayNights(input.nights, input.minNights, input.maxNights);
  if (clamped <= 0) return 0;
  if (input.countSunday) return clamped;
  const from = bakuDateKey(input.startsOn);
  let counted = 0;
  let walked = 0;
  let ymd = from;
  for (let guard = 0; walked < clamped && guard < 400; guard++) {
    const noon = parseBakuDateTime(ymd, "12:00");
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Baku",
      weekday: "short",
    }).format(noon);
    if (weekday !== "Sun") counted += 1;
    walked += 1;
    ymd = addBakuDays(ymd, 1);
  }
  return counted;
}

export function resolveBlockQuotaTotal(input: {
  quotaMode: "FIXED" | "DAILY_RATE";
  countSunday: boolean;
  nights: number;
  checkIn: Date;
  endsOn: Date;
  procedure: {
    quotaTotal: number;
    procedureCode: string;
    kind?: string | null;
    quotaBasis?: string | null;
    blockQuotaMode?: string | null;
    quotaPerNight?: unknown;
    quotaPerWeek?: number | null;
    dailyDistinctCap?: number | null;
  };
  knots: Array<{ nights: number; procedureCode: string; qty: number }>;
  minNights?: number | null;
  maxNights?: number | null;
}): number {
  if (input.quotaMode === "DAILY_RATE") {
    const blockMode = resolveBlockQuotaMode(
      input.procedure.blockQuotaMode,
      defaultBlockQuotaMode({
        kind: input.procedure.kind,
        quotaBasis: input.procedure.quotaBasis,
      }),
    );
    if (blockMode === "PER_STAY") {
      return Math.max(0, Math.floor(Number(input.procedure.quotaTotal) || 0));
    }
    if (blockMode === "WEEKLY") {
      return weeklyQuotaTotal({
        nights: input.nights,
        quotaPerWeek: input.procedure.quotaPerWeek,
        minNights: input.minNights,
        maxNights: input.maxNights,
      });
    }
    const counted = countedNightsForDailyRate({
      startsOn: input.checkIn,
      endsOn: input.endsOn,
      nights: input.nights,
      countSunday: input.countSunday,
      minNights: input.minNights,
      maxNights: input.maxNights,
    });
    return dailyRateQuotaTotal({
      countedNights: counted,
      quotaPerNight: asQuotaRate(input.procedure.quotaPerNight),
    });
  }
  let quotaTotal = input.procedure.quotaTotal;
  if (input.knots.length > 0) {
    quotaTotal = quotaFor({
      knots: input.knots,
      nights: input.nights,
      procedureCode: input.procedure.procedureCode,
      minNights: input.minNights,
      maxNights: input.maxNights,
      quotaBasis:
        input.procedure.quotaBasis === "PER_STAY" ? "PER_STAY" : "PER_NIGHTS",
    });
  }
  if (input.knots.length === 0 && input.procedure.quotaBasis !== "PER_STAY") {
    const perDay = resolveDailyDistinctCap(
      input.procedure.kind,
      input.procedure.dailyDistinctCap,
    );
    const procedureDays = nonSundayStayNights(input.checkIn, input.endsOn);
    quotaTotal = Math.min(quotaTotal, procedureDays * perDay);
  }
  return quotaTotal;
}

export async function recalcProgramQuotas(
  instanceId: string,
  opts: {
    nights: number;
    programCode?: string;
    startsOn?: Date;
    endsOn?: Date;
    reservationId?: string | null;
    /** Manual package apply: pin the course to the current template version of the same code. */
    adoptCurrentVersion?: boolean;
  },
) {
  const instance = await prisma.programInstance.findUnique({
    where: { id: instanceId },
    include: { procedureLines: true },
  });
  if (!instance) throw new Error("Program instance not found");

  const code = opts.programCode ?? instance.programCode;
  const packageCodeChanged = Boolean(opts.programCode && opts.programCode !== instance.programCode);
  const adoptCurrent = Boolean(opts.adoptCurrentVersion) || packageCodeChanged;

  let template = adoptCurrent
    ? await findCurrentProgramTemplate(code)
    : await prisma.programTemplate.findUnique({
        where: { id: instance.templateId },
        include: programTemplateInclude,
      });

  if (!template) throw new Error(`Program template ${code} not found`);

  const snapshot = buildEntitlementSnapshot({
    templateId: template.id,
    code: template.code,
    version: template.version,
    quotaMode: (template as { quotaMode?: string | null }).quotaMode,
    countSunday: (template as { countSunday?: boolean | null }).countSunday,
    procedures: template.procedures,
    knots: template.quotaKnots,
    members: template.blockMembers,
  });

  const newCodes = new Set(
    template.procedures.map((p: { procedureCode: string }) => p.procedureCode),
  );
  const existingByCode = new Map(
    instance.procedureLines.map((l) => [l.procedureCode, l]),
  );

  const addedCodes: string[] = [];

  const stayStart = opts.startsOn ?? instance.startsOn;
  const stayEnd = opts.endsOn ?? instance.endsOn;
  const quotaMode = resolveQuotaMode(
    (template as { quotaMode?: string | null }).quotaMode,
  );
  const countSunday = Boolean((template as { countSunday?: boolean }).countSunday);

  for (const p of template.procedures) {
    const newTotal = resolveBlockQuotaTotal({
      quotaMode,
      countSunday,
      nights: opts.nights,
      checkIn: stayStart,
      endsOn: stayEnd,
      procedure: p,
      knots: template.quotaKnots,
      minNights: template.minNights,
      maxNights: template.maxNights,
    });
    const existing = existingByCode.get(p.procedureCode);
    if (existing) {
      const { quotaTotal } = applyQuotaRecalc(existing.quotaUsed, newTotal);
      await prisma.programProcedureBalance.update({
        where: { id: existing.id },
        data: { quotaTotal },
      });
    } else {
      await prisma.programProcedureBalance.create({
        data: {
          instanceId,
          procedureCode: p.procedureCode,
          quotaTotal: newTotal,
          quotaUsed: 0,
        },
      });
      addedCodes.push(p.procedureCode);
    }
  }

  // Codes removed from the package: delete an unused balance. Keep a row that
  // already has a document. Bath-transfer buckets (XFER-*) are not template lines.
  for (const line of instance.procedureLines) {
    if (line.procedureCode.toUpperCase().startsWith("XFER-")) continue;
    if (!newCodes.has(line.procedureCode)) {
      const [orders, labs, visits] = await Promise.all([
        prisma.procedureOrder.count({
          where: {
            clinicalEpisodeId: instance.episodeId,
            packageQuotaCode: line.procedureCode,
          },
        }),
        prisma.labOrderItem.count({
          where: {
            packageQuotaCode: line.procedureCode,
            labOrder: { clinicalEpisodeId: instance.episodeId },
          },
        }),
        prisma.visitServiceLine.count({
          where: {
            packageQuotaCode: line.procedureCode,
            visit: { clinicalEpisodeId: instance.episodeId },
          },
        }),
      ]);
      if (line.quotaUsed === 0 && orders + labs + visits === 0) {
        await prisma.programProcedureBalance.delete({ where: { id: line.id } });
        continue;
      }
      await prisma.programProcedureBalance.update({
        where: { id: line.id },
        data: { quotaTotal: Math.max(line.quotaUsed, 0) },
      });
      if (opts.reservationId ?? instance.reservationId) {
        const reservationId = opts.reservationId ?? instance.reservationId!;
        const dropped = await prisma.procedureOrder.findMany({
          where: {
            reservationId,
            procedureCode: line.procedureCode,
            status: "PROPOSED",
          },
          select: { id: true },
        });
        if (dropped.length > 0) {
          await prisma.procedureOrder.updateMany({
            where: { id: { in: dropped.map((row) => row.id) } },
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancelReason: "package_code_dropped",
            },
          });
          await releaseProcedureOccupancy(dropped.map((row) => row.id));
        }
      }
    }
  }

  await prisma.programInstance.update({
    where: { id: instanceId },
    data: {
      programCode: code,
      ...(adoptCurrent
        ? { templateId: template.id, entitlementSnapshot: snapshot }
        : instance.entitlementSnapshot
          ? {}
          : { entitlementSnapshot: snapshot }),
      ...(opts.startsOn ? { startsOn: opts.startsOn } : {}),
      ...(opts.endsOn ? { endsOn: opts.endsOn } : {}),
    },
  });

  if (opts.endsOn) {
    const { cancelFutureScheduledPastEnd } = await import(
      "@/domain/sanatorium/package-assign.service"
    );
    await cancelFutureScheduledPastEnd(instanceId, opts.endsOn);
  }

  if (opts.adoptCurrentVersion) {
    const { cancelExcessPlannedSessions } = await import(
      "@/domain/sanatorium/package-assign.service"
    );
    await cancelExcessPlannedSessions(instanceId);
  }

  if (packageCodeChanged) {
    await prisma.clinicalEpisode.update({
      where: { id: instance.episodeId },
      data: {
        programCode: code,
        noPackageConfirmedAt: null,
        noPackageConfirmedByUserId: null,
      },
    });
  }

  // Rows added by this recalc start at quotaUsed 0 while stamped fulfillments may
  // already exist for those codes (package switch, nights growth). Re-derive only
  // the new rows: a blanket resync would zero legacy instances whose historical
  // fulfillments are not stamped yet — that is the backfill script's job.
  if (addedCodes.length > 0) {
    const { syncEntitlementUsage } = await import(
      "@/domain/sanatorium/entitlement-usage.service"
    );
    for (const quotaCode of addedCodes) {
      await syncEntitlementUsage({
        instanceId,
        episodeId: instance.episodeId,
        quotaCode,
      });
    }
  }

  return prisma.programInstance.findUnique({
    where: { id: instanceId },
    include: { procedureLines: true },
  });
}

/**
 * @deprecated CLI-57 — package assign is lazy via package-assign API. No-op retained for import safety.
 */
export async function scheduleProgramProcedures(
  _instanceId: string,
  _startsOn: Date,
) {
  return 0;
}

/**
 * @deprecated Prefer `isOverEntitlementQuota` from entitlement-usage.service.
 * Read-only over-quota check — does NOT increment quotaUsed (CLI-57 single COUNT SoT).
 */
export async function useProcedureQuota(input: {
  instanceId: string;
  procedureCode: string;
}): Promise<{ allowed: boolean; overQuota: boolean }> {
  const { isOverEntitlementQuota } = await import(
    "@/domain/sanatorium/entitlement-usage.service"
  );
  const r = await isOverEntitlementQuota({
    instanceId: input.instanceId,
    quotaCode: input.procedureCode,
  });
  return { allowed: true, overQuota: r.overQuota };
}
