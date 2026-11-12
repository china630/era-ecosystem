import { prisma } from "@/lib/prisma";

export type TimesheetImportRow = {
  projectId: string;
  workerRef: string;
  cpEmploymentId?: string | null;
  hours: number;
  workDate: Date;
};

export async function createTimesheetEntriesBatch(rows: TimesheetImportRow[]) {
  return prisma.$transaction(
    rows.map((row) =>
      prisma.timesheetEntry.create({
        data: {
          projectId: row.projectId,
          workerRef: row.workerRef,
          cpEmploymentId: row.cpEmploymentId ?? null,
          hours: row.hours,
          workDate: row.workDate,
          source: "CSV",
        },
      }),
    ),
  );
}
