import { prisma } from "@/lib/prisma";
import { findProjectById } from "@/lib/projects.service";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { requestOrganizationId } from "@/lib/request-organization";
import { SATELLITE_CONSTRUCTION_DAILY_LOG_SUBMITTED } from "@era/contracts";

export async function listDailyLogs(projectId: string) {
  return prisma.dailyLog.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { logDate: "desc" },
  });
}

export type CreateDailyLogInput = {
  logDate: Date;
  weather?: string;
  crewCount?: number;
  notes?: string;
  reportedBy?: string;
  crewByPartyJson?: string;
  equipmentNotes?: string;
  photoUrl?: string;
};

export async function createDailyLog(projectId: string, body: CreateDailyLogInput) {
  const project = await findProjectById(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  const row = await prisma.dailyLog.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      logDate: body.logDate,
      weather: body.weather,
      crewCount: body.crewCount,
      notes: body.notes,
      reportedBy: body.reportedBy,
      crewByPartyJson: body.crewByPartyJson,
      equipmentNotes: body.equipmentNotes,
      photoUrl: body.photoUrl,
      status: "DRAFT",
    },
  });
  return { row };
}

export async function submitDailyLog(projectId: string, logId: string) {
  const row = await prisma.dailyLog.findFirst({
    where: { id: logId, projectId, deletedAt: null },
  });
  if (!row) return { error: "Daily log not found" as const, status: 404 as const };
  if (row.status === "SUBMITTED") {
    return { error: "Daily log already submitted", status: 409 as const };
  }
  const updated = await prisma.dailyLog.update({
    where: { id: logId },
    data: { status: "SUBMITTED" },
  });
  try {
    await dispatchSatelliteEvent({
      type: SATELLITE_CONSTRUCTION_DAILY_LOG_SUBMITTED,
      payload: { projectId, entityId: logId },
    });
  } catch {
    // best-effort
  }
  return { row: updated };
}
