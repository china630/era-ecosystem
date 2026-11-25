import { prisma } from "@/lib/prisma";
import { findProjectById } from "@/lib/projects.service";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import {
  SATELLITE_CONSTRUCTION_ISSUE_CLOSED,
  SATELLITE_CONSTRUCTION_ISSUE_CREATED,
} from "@era/contracts";
import { requestOrganizationId } from "@/lib/request-organization";
import { PUNCH_STATUS_TRANSITIONS } from "@/lib/punch-status";

export async function listPunchListItems(projectId: string) {
  return prisma.punchListItem.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export type CreatePunchListItemInput = {
  location: string;
  description: string;
  photoUrl?: string;
  assignee?: string;
  dueDate?: string | null;
  drawingRevisionId?: string | null;
  pinX?: number | null;
  pinY?: number | null;
  ifcElementId?: string | null;
  externalViewerUrl?: string | null;
};

export async function createPunchListItem(projectId: string, body: CreatePunchListItemInput) {
  const project = await findProjectById(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };

  if (body.drawingRevisionId) {
    const sheet = await prisma.drawingRevision.findFirst({
      where: {
        id: body.drawingRevisionId,
        projectId,
        deletedAt: null,
      },
    });
    if (!sheet) {
      return { error: "Drawing revision not found on project", status: 400 as const };
    }
    if (sheet.status !== "CURRENT") {
      return { error: "Can only pin punch to a CURRENT sheet", status: 400 as const };
    }
  }

  const row = await prisma.punchListItem.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      location: body.location,
      description: body.description,
      photoUrl: body.photoUrl,
      assignee: body.assignee,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      drawingRevisionId: body.drawingRevisionId ?? null,
      pinX: body.pinX ?? null,
      pinY: body.pinY ?? null,
      ifcElementId: body.ifcElementId?.trim() || null,
      externalViewerUrl: body.externalViewerUrl?.trim() || null,
      status: "OPEN",
    },
  });
  try {
    await dispatchSatelliteEvent({
      type: SATELLITE_CONSTRUCTION_ISSUE_CREATED,
      payload: { projectId, entityId: row.id },
    });
  } catch {
    // best-effort
  }
  return { row };
}

export async function findPunchListItem(projectId: string, itemId: string) {
  return prisma.punchListItem.findFirst({
    where: { id: itemId, projectId, deletedAt: null },
  });
}

export async function updatePunchListItemStatus(
  projectId: string,
  itemId: string,
  status: "OPEN" | "FIXED" | "VERIFIED",
) {
  const item = await findPunchListItem(projectId, itemId);
  if (!item) return { error: "Item not found" as const, status: 404 as const };
  const allowed = PUNCH_STATUS_TRANSITIONS[item.status] ?? [];
  if (!allowed.includes(status)) {
    return {
      error: `Cannot transition punch ${item.status} → ${status}`,
      status: 409 as const,
    };
  }
  const updated = await prisma.punchListItem.update({
    where: { id: itemId },
    data: { status },
  });
  if (status === "VERIFIED") {
    try {
      await dispatchSatelliteEvent({
        type: SATELLITE_CONSTRUCTION_ISSUE_CLOSED,
        payload: { projectId, entityId: itemId },
      });
    } catch {
      // best-effort
    }
  }
  return { row: updated };
}

export { PUNCH_STATUS_TRANSITIONS, punchStatusOptions } from "@/lib/punch-status";
