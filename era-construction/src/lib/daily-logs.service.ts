import { prisma } from "@/lib/prisma";

export async function listDailyLogs(projectId: string) {
  return prisma.dailyLog.findMany({
    where: { projectId },
    orderBy: { logDate: "desc" },
  });
}

export type CreateDailyLogInput = {
  logDate: Date;
  weather?: string;
  crewCount?: number;
  notes?: string;
  reportedBy?: string;
};

export async function createDailyLog(projectId: string, body: CreateDailyLogInput) {
  return prisma.dailyLog.create({
    data: {
      projectId,
      logDate: body.logDate,
      weather: body.weather,
      crewCount: body.crewCount,
      notes: body.notes,
      reportedBy: body.reportedBy,
    },
  });
}
