import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

export async function listDaySeries() {
  return prisma.procedureDaySeries.findMany({
    orderBy: { sortOrder: "asc" },
    include: { members: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function saveDaySeries(input: {
  id?: string;
  code: string;
  name: string;
  fillsRestDays: boolean;
  members: Array<{ procedureCode: string; shortMark: string }>;
}) {
  const organizationId = requestOrganizationId();
  const series = input.id
    ? await prisma.procedureDaySeries.update({
        where: { id: input.id },
        data: { code: input.code, name: input.name, fillsRestDays: input.fillsRestDays, active: true },
      })
    : await prisma.procedureDaySeries.create({
        data: {
          organizationId,
          code: input.code,
          name: input.name,
          fillsRestDays: input.fillsRestDays,
          active: true,
        },
      });
  await prisma.procedureDaySeriesMember.deleteMany({ where: { seriesId: series.id } });
  if (input.members.length > 0) {
    await prisma.procedureDaySeriesMember.createMany({
      data: input.members.map((member, index) => ({
        organizationId,
        seriesId: series.id,
        procedureCode: member.procedureCode,
        shortMark: member.shortMark,
        sortOrder: index,
      })),
    });
  }
  return prisma.procedureDaySeries.findUnique({
    where: { id: series.id },
    include: { members: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function deleteDaySeries(id: string) {
  await prisma.procedureDaySeries.delete({ where: { id } });
}
