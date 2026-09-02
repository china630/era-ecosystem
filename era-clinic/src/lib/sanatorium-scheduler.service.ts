import { prisma } from "@/lib/prisma";
import { planProgramFifo } from "@/lib/treatment-planner.service";
import { nightsBetween, quotaFor, applyQuotaRecalc } from "@/lib/program-quota";

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
  const template = await prisma.programTemplate.findFirst({
    where: { code: input.programCode },
    include: { procedures: true, quotaKnots: true },
  });
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

  const balanceRows = template.procedures.map((p) => {
    let quotaTotal = p.quotaTotal;
    if (template.quotaKnots.length > 0) {
      quotaTotal = quotaFor({
        knots: template.quotaKnots,
        nights,
        procedureCode: p.procedureCode,
        minNights: template.minNights,
        maxNights: template.maxNights,
      });
    }
    return {
      procedureCode: p.procedureCode,
      quotaTotal,
      quotaUsed: 0,
    };
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
    },
  });
  if (balanceRows.length > 0) {
    await prisma.programProcedureBalance.createMany({
      data: balanceRows.map((row) => ({
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

  await prisma.clinicalEpisode.update({
    where: { id: input.episodeId },
    data: { programCode: template.code },
  });

  await scheduleProgramProcedures(instance.id, input.startsOn);
  return instance;
}

/**
 * Recalculate balances after nights or package change.
 * Never decreases quotaUsed; does not cancel SCHEDULED.
 * Drops only PROPOSED for codes removed from the new package.
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
  const template = await prisma.programTemplate.findFirst({
    where: { code },
    include: { procedures: true, quotaKnots: true },
  });
  if (!template) throw new Error(`Program template ${code} not found`);

  const newCodes = new Set(template.procedures.map((p) => p.procedureCode));
  const existingByCode = new Map(
    instance.procedureLines.map((l) => [l.procedureCode, l]),
  );

  for (const p of template.procedures) {
    let newTotal = p.quotaTotal;
    if (template.quotaKnots.length > 0) {
      newTotal = quotaFor({
        knots: template.quotaKnots,
        nights: opts.nights,
        procedureCode: p.procedureCode,
        minNights: template.minNights,
        maxNights: template.maxNights,
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
      templateId: template.id,
      ...(opts.endsOn ? { endsOn: opts.endsOn } : {}),
    },
  });

  return prisma.programInstance.findUnique({
    where: { id: instanceId },
    include: { procedureLines: true },
  });
}

export async function scheduleProgramProcedures(
  instanceId: string,
  startsOn: Date,
) {
  await planProgramFifo(instanceId, startsOn);
}

export async function useProcedureQuota(input: {
  instanceId: string;
  procedureCode: string;
}): Promise<{ allowed: boolean; overQuota: boolean }> {
  const line = await prisma.programProcedureBalance.findUnique({
    where: {
      instanceId_procedureCode: {
        instanceId: input.instanceId,
        procedureCode: input.procedureCode,
      },
    },
  });
  if (!line) return { allowed: true, overQuota: false };
  if (line.quotaUsed >= line.quotaTotal) {
    return { allowed: true, overQuota: true };
  }
  await prisma.programProcedureBalance.update({
    where: { id: line.id },
    data: { quotaUsed: { increment: 1 } },
  });
  return { allowed: true, overQuota: false };
}
