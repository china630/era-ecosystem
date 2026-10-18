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
  const code = input.code.trim();
  const existing = input.id
    ? await prisma.procedureDaySeries.findUnique({ where: { id: input.id } })
    : await prisma.procedureDaySeries.findFirst({ where: { code } });
  const series = existing
    ? await prisma.procedureDaySeries.update({
        where: { id: existing.id },
        data: { code, name: input.name, fillsRestDays: input.fillsRestDays, active: true },
      })
    : await prisma.procedureDaySeries.create({
        data: {
          organizationId,
          code,
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
