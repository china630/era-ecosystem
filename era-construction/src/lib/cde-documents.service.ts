import { prisma } from "@/lib/prisma";
import { findProjectById } from "@/lib/projects.service";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { requestOrganizationId } from "@/lib/request-organization";
import { SATELLITE_CONSTRUCTION_DOCUMENT_REVISION_PUBLISHED } from "@era/contracts";

export async function listDrawingRevisions(projectId: string | null) {
  return prisma.drawingRevision.findMany({
    where: projectId ? { projectId, deletedAt: null } : { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export type CreateDrawingRevisionInput = {
  projectId: string;
  drawingCode: string;
  revision: string;
  sheetNumber?: string;
  fileName?: string;
  /** When true, mark prior CURRENT rows for same drawingCode as SUPERSEDED. */
  publish?: boolean;
};

/**
 * Create a drawing revision. Publish sets status CURRENT and supersedes
 * previous CURRENT revisions of the same drawingCode on the project.
 */
export async function createDrawingRevision(body: CreateDrawingRevisionInput) {
  const project = await findProjectById(body.projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };

  const publish = body.publish !== false;
  const created = await prisma.$transaction(async (tx) => {
    if (publish) {
      await tx.drawingRevision.updateMany({
        where: {
          projectId: body.projectId,
          drawingCode: body.drawingCode,
          status: "CURRENT",
          deletedAt: null,
        },
        data: { status: "SUPERSEDED" },
      });
    }
    return tx.drawingRevision.create({
      data: {
        organizationId: requestOrganizationId(),
        projectId: body.projectId,
        drawingCode: body.drawingCode,
        revision: body.revision,
        sheetNumber: body.sheetNumber,
        fileName: body.fileName,
        status: publish ? "CURRENT" : "CURRENT",
      },
    });
  });

  if (publish) {
    try {
      await dispatchSatelliteEvent({
        type: SATELLITE_CONSTRUCTION_DOCUMENT_REVISION_PUBLISHED,
        payload: { projectId: body.projectId, entityId: created.id },
      });
    } catch {
      // best-effort
    }
  }

  return { row: created };
}
