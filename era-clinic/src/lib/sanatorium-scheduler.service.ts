import { prisma } from "@/lib/prisma";
import { planProgramFifo } from "@/lib/treatment-planner.service";

export async function instantiateProgramFromTemplate(input: {
  episodeId: string;
  programCode: string;
  reservationId?: string;
  startsOn: Date;
}) {
  const template = await prisma.programTemplate.findFirst({
    where: { code: input.programCode },
    include: { procedures: true },
  });
  if (!template) throw new Error(`Program template ${input.programCode} not found`);

  const endsOn = new Date(input.startsOn);
  endsOn.setDate(endsOn.getDate() + template.durationDays);

  const instance = await prisma.programInstance.create({
    data: {
      templateId: template.id,
      episodeId: input.episodeId,
      reservationId: input.reservationId,
      programCode: template.code,
      startsOn: input.startsOn,
      endsOn,
      procedureLines: {
        create: template.procedures.map((p) => ({
          procedureCode: p.procedureCode,
          quotaTotal: p.quotaTotal,
          quotaUsed: 0,
        })),
      },
    },
    include: { procedureLines: true },
  });

  await prisma.clinicalEpisode.update({
    where: { id: input.episodeId },
    data: { programCode: template.code },
  });

  await scheduleProgramProcedures(instance.id, input.startsOn);
  return instance;
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
