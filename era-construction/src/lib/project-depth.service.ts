import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import {
  SATELLITE_CONSTRUCTION_CHANGE_REQUEST_APPROVED_OPS,
  SATELLITE_CONSTRUCTION_INSPECTION_FAILED,
  SATELLITE_CONSTRUCTION_RFI_ANSWERED,
  SATELLITE_CONSTRUCTION_SUBMITTAL_STATUS_CHANGED,
} from "@era/contracts";

const notDeleted = { deletedAt: null as null };

const PARTY_ROLES = ["GC", "SUB", "OWNER", "INSPECTOR"] as const;
const SUBMITTAL_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED", "REVISE"],
  REVISE: ["IN_REVIEW"],
  APPROVED: [],
  REJECTED: [],
};
const CHANGE_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED_OPS"],
  APPROVED_OPS: [],
};
const RFI_ANSWERABLE = new Set(["OPEN", "OVERDUE"]);

async function requireProject(projectId: string) {
  return prisma.project.findFirst({ where: { id: projectId, ...notDeleted } });
}

async function emitStub(type: string, projectId: string, entityId: string) {
  try {
    await dispatchSatelliteEvent({
      type,
      payload: { projectId, entityId },
    });
  } catch {
    // best-effort; ops UI still succeeds
  }
}

// ——— Parties ———

export async function listParties(projectId: string, role?: string) {
  return prisma.projectParty.findMany({
    where: {
      projectId,
      ...notDeleted,
      ...(role ? { role } : {}),
    },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });
}

export async function createParty(
  projectId: string,
  body: {
    role: (typeof PARTY_ROLES)[number];
    displayName: string;
    financeCounterpartyId?: string | null;
  },
) {
  const project = await requireProject(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  if (!PARTY_ROLES.includes(body.role)) {
    return { error: "Invalid party role" as const, status: 400 as const };
  }
  const row = await prisma.projectParty.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      role: body.role,
      displayName: body.displayName,
      financeCounterpartyId: body.financeCounterpartyId ?? null,
    },
  });
  return { row };
}

export async function softDeleteParty(projectId: string, partyId: string) {
  const row = await prisma.projectParty.findFirst({
    where: { id: partyId, projectId, ...notDeleted },
  });
  if (!row) return { error: "Party not found" as const, status: 404 as const };
  const updated = await prisma.projectParty.update({
    where: { id: partyId },
    data: { deletedAt: new Date() },
  });
  return { row: updated };
}

// ——— RFI ———

export async function listRfis(projectId: string) {
  return prisma.rfi.findMany({
    where: { projectId, ...notDeleted },
    orderBy: { createdAt: "desc" },
  });
}

export async function createRfi(
  projectId: string,
  body: {
    subject: string;
    question: string;
    assignee?: string;
    dueDate?: string | null;
    impactSchedule?: boolean;
    impactCost?: boolean;
    ifcElementId?: string | null;
    externalViewerUrl?: string | null;
  },
) {
  const project = await requireProject(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  const row = await prisma.rfi.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      subject: body.subject,
      question: body.question,
      assignee: body.assignee,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      impactSchedule: body.impactSchedule ?? false,
      impactCost: body.impactCost ?? false,
      ifcElementId: body.ifcElementId?.trim() || null,
      externalViewerUrl: body.externalViewerUrl?.trim() || null,
    },
  });
  return { row };
}

export async function answerRfi(
  projectId: string,
  rfiId: string,
  body: { answer: string; impactSchedule?: boolean; impactCost?: boolean },
) {
  const row = await prisma.rfi.findFirst({
    where: { id: rfiId, projectId, ...notDeleted },
  });
  if (!row) return { error: "RFI not found" as const, status: 404 as const };
  if (!RFI_ANSWERABLE.has(row.status)) {
    return { error: `RFI status ${row.status} cannot be answered`, status: 409 as const };
  }
  const updated = await prisma.rfi.update({
    where: { id: rfiId },
    data: {
      answer: body.answer,
      status: "ANSWERED",
      impactSchedule: body.impactSchedule ?? row.impactSchedule,
      impactCost: body.impactCost ?? row.impactCost,
    },
  });
  await emitStub(SATELLITE_CONSTRUCTION_RFI_ANSWERED, projectId, rfiId);
  return { row: updated };
}

// ——— Submittal ———

export async function listSubmittals(projectId: string) {
  return prisma.submittal.findMany({
    where: { projectId, ...notDeleted },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSubmittal(
  projectId: string,
  body: { title: string; specSection?: string },
) {
  const project = await requireProject(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  const row = await prisma.submittal.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      title: body.title,
      specSection: body.specSection,
      status: "DRAFT",
    },
  });
  return { row };
}

export async function transitionSubmittal(
  projectId: string,
  submittalId: string,
  status: string,
) {
  const row = await prisma.submittal.findFirst({
    where: { id: submittalId, projectId, ...notDeleted },
  });
  if (!row) return { error: "Submittal not found" as const, status: 404 as const };
  const allowed = SUBMITTAL_TRANSITIONS[row.status] ?? [];
  if (!allowed.includes(status)) {
    return {
      error: `Cannot transition submittal ${row.status} → ${status}`,
      status: 409 as const,
    };
  }
  const updated = await prisma.submittal.update({
    where: { id: submittalId },
    data: { status },
  });
  await emitStub(SATELLITE_CONSTRUCTION_SUBMITTAL_STATUS_CHANGED, projectId, submittalId);
  return { row: updated };
}

// ——— Inspection ———

export async function listInspections(projectId: string) {
  return prisma.siteInspection.findMany({
    where: { projectId, ...notDeleted },
    orderBy: { createdAt: "desc" },
  });
}

export async function createInspection(
  projectId: string,
  body: { title: string; formJson?: string },
) {
  const project = await requireProject(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  const row = await prisma.siteInspection.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      title: body.title,
      formJson: body.formJson ?? "{}",
      status: "DRAFT",
    },
  });
  return { row };
}

export async function failInspection(projectId: string, inspectionId: string) {
  const row = await prisma.siteInspection.findFirst({
    where: { id: inspectionId, projectId, ...notDeleted },
  });
  if (!row) return { error: "Inspection not found" as const, status: 404 as const };
  if (row.status === "FAILED") {
    return { error: "Inspection already failed", status: 409 as const };
  }
  const updated = await prisma.siteInspection.update({
    where: { id: inspectionId },
    data: { status: "FAILED" },
  });
  const punch = await prisma.punchListItem.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      location: "Inspection",
      description: `Failed inspection: ${row.title}`,
      status: "OPEN",
    },
  });
  await emitStub(SATELLITE_CONSTRUCTION_INSPECTION_FAILED, projectId, inspectionId);
  return { row: updated, punch };
}

// ——— Change request ———

export async function listChangeRequests(projectId: string) {
  return prisma.changeRequest.findMany({
    where: { projectId, ...notDeleted },
    orderBy: { createdAt: "desc" },
  });
}

export async function createChangeRequest(
  projectId: string,
  body: {
    title: string;
    description?: string;
    rfiId?: string | null;
    financeContractId?: string | null;
    impactSchedule?: boolean;
    impactCost?: boolean;
  },
) {
  const project = await requireProject(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  if (body.rfiId) {
    const rfi = await prisma.rfi.findFirst({
      where: { id: body.rfiId, projectId, ...notDeleted },
    });
    if (!rfi) return { error: "RFI not found on project" as const, status: 400 as const };
  }
  const row = await prisma.changeRequest.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      title: body.title,
      description: body.description,
      rfiId: body.rfiId ?? null,
      financeContractId: body.financeContractId ?? null,
      impactSchedule: body.impactSchedule ?? false,
      impactCost: body.impactCost ?? false,
      status: "DRAFT",
    },
  });
  return { row };
}

export async function transitionChangeRequest(
  projectId: string,
  changeId: string,
  status: string,
) {
  const row = await prisma.changeRequest.findFirst({
    where: { id: changeId, projectId, ...notDeleted },
  });
  if (!row) return { error: "Change request not found" as const, status: 404 as const };
  const allowed = CHANGE_TRANSITIONS[row.status] ?? [];
  if (!allowed.includes(status)) {
    return {
      error: `Cannot transition change request ${row.status} → ${status}`,
      status: 409 as const,
    };
  }
  const updated = await prisma.changeRequest.update({
    where: { id: changeId },
    data: { status },
  });
  if (status === "APPROVED_OPS") {
    try {
      await dispatchSatelliteEvent({
        type: SATELLITE_CONSTRUCTION_CHANGE_REQUEST_APPROVED_OPS,
        payload: {
          projectId,
          entityId: changeId,
          changeRequestId: changeId,
          ...(row.financeContractId
            ? { financeContractId: row.financeContractId }
            : {}),
          description: row.title ?? undefined,
        },
      });
    } catch {
      // best-effort; ops UI still succeeds
    }
  }
  return { row: updated };
}

// ——— Phases / locations (still thin stubs) ———

export async function listPhases(projectId: string) {
  return prisma.projectPhase.findMany({
    where: { projectId, ...notDeleted },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createPhase(
  projectId: string,
  body: { code: string; name: string; sortOrder?: number },
) {
  const project = await requireProject(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  const row = await prisma.projectPhase.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      code: body.code,
      name: body.name,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return { row };
}

export async function listLocations(projectId: string) {
  return prisma.projectLocation.findMany({
    where: { projectId, ...notDeleted },
    orderBy: { code: "asc" },
  });
}

export async function createLocation(projectId: string, body: { code: string; name: string }) {
  const project = await requireProject(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  const row = await prisma.projectLocation.create({
    data: {
      organizationId: requestOrganizationId(),
      projectId,
      code: body.code,
      name: body.name,
    },
  });
  return { row };
}

export async function softDeletePhase(projectId: string, phaseId: string) {
  const row = await prisma.projectPhase.findFirst({
    where: { id: phaseId, projectId, ...notDeleted },
  });
  if (!row) return { error: "Phase not found" as const, status: 404 as const };
  const updated = await prisma.projectPhase.update({
    where: { id: phaseId },
    data: { deletedAt: new Date() },
  });
  return { row: updated };
}

export async function softDeleteLocation(projectId: string, locationId: string) {
  const row = await prisma.projectLocation.findFirst({
    where: { id: locationId, projectId, ...notDeleted },
  });
  if (!row) return { error: "Location not found" as const, status: 404 as const };
  const updated = await prisma.projectLocation.update({
    where: { id: locationId },
    data: { deletedAt: new Date() },
  });
  return { row: updated };
}

export const PROJECT_PARTY_ROLES = PARTY_ROLES;
export const SUBMITTAL_STATUS_TRANSITIONS = SUBMITTAL_TRANSITIONS;
export const CHANGE_STATUS_TRANSITIONS = CHANGE_TRANSITIONS;
