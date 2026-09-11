import { prisma } from "@/lib/prisma";
import { nightsBetween, quotaFor, applyQuotaRecalc } from "@/lib/program-quota";
import {
  buildEntitlementSnapshot,
  findCurrentProgramTemplate,
  programTemplateInclude,
} from "@/domain/sanatorium/program-template-admin";

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

  const checkIn = input.checkInDate ?? input.startsOn;
  const checkOut =
    input.checkOutDate ??
    (() => {
      const d = new Date(input.startsOn);
      d.setDate(d.getDate() + template.durationDays);
      return d;
    })();
  const nights =
    input.nights ??
    (nightsBetween(checkIn, checkOut) || template.durationDays);

  const endsOn = checkOut;

  const balanceRows = template.procedures.map(
    (p: {
      quotaTotal: number;
      procedureCode: string;
      quotaBasis?: string | null;
    }) => {
    let quotaTotal = p.quotaTotal;
    if (template.quotaKnots.length > 0) {
      quotaTotal = quotaFor({
        knots: template.quotaKnots,
        nights,
        procedureCode: p.procedureCode,
        minNights: template.minNights,
        maxNights: template.maxNights,
        quotaBasis: p.quotaBasis === "PER_STAY" ? "PER_STAY" : "PER_NIGHTS",
      });
    }
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
      startsOn: input.startsOn,
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

  // CLI-57: balances only — doctor assigns via package modal (no buildProposedPlan pre-expand).
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
export async function recalcProgramQuotas(
  instanceId: string,
  opts: {
    nights: number;
    programCode?: string;
    endsOn?: Date;
    reservationId?: string | null;
  },
) {
  const instance = await prisma.programInstance.findUnique({
    where: { id: instanceId },
    include: { procedureLines: true },
  });
  if (!instance) throw new Error("Program instance not found");

  const code = opts.programCode ?? instance.programCode;
  const packageCodeChanged = Boolean(opts.programCode && opts.programCode !== instance.programCode);

  let template = packageCodeChanged
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

  for (const p of template.procedures) {
    let newTotal = p.quotaTotal;
    if (template.quotaKnots.length > 0) {
      newTotal = quotaFor({
        knots: template.quotaKnots,
        nights: opts.nights,
        procedureCode: p.procedureCode,
        minNights: template.minNights,
        maxNights: template.maxNights,
        quotaBasis: p.quotaBasis === "PER_STAY" ? "PER_STAY" : "PER_NIGHTS",
      });
    }
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

  // Codes only in old package: remaining 0 (keep used for history)
  for (const line of instance.procedureLines) {
    if (!newCodes.has(line.procedureCode)) {
      await prisma.programProcedureBalance.update({
        where: { id: line.id },
        data: { quotaTotal: Math.max(line.quotaUsed, 0) },
      });
      if (opts.reservationId ?? instance.reservationId) {
        await prisma.procedureOrder.updateMany({
          where: {
            reservationId: opts.reservationId ?? instance.reservationId!,
            procedureCode: line.procedureCode,
            status: "PROPOSED",
          },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelReason: "package_code_dropped",
          },
        });
      }
    }
  }

  await prisma.programInstance.update({
    where: { id: instanceId },
    data: {
      programCode: code,
      ...(packageCodeChanged
        ? { templateId: template.id, entitlementSnapshot: snapshot }
        : instance.entitlementSnapshot
          ? {}
          : { entitlementSnapshot: snapshot }),
      ...(opts.endsOn ? { endsOn: opts.endsOn } : {}),
    },
  });

  if (opts.endsOn) {
    const { cancelFutureScheduledPastEnd } = await import(
      "@/domain/sanatorium/package-assign.service"
    );
    await cancelFutureScheduledPastEnd(instanceId, opts.endsOn);
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
