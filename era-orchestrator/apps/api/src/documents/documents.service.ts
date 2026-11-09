import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DocDecisionOutcome,
  DocKind,
  DocRouteInstanceStatus,
  DocStepJoin,
  DocStatus,
  DocStepAction,
  DocTaskStatus,
  Prisma,
  WorkforceEmploymentStatus,
} from "@era365/database";
import { stepApplies } from "../platform/workforce/workforce-reporting.resolve";
import { chainEdges, stepSkipped } from "./documents-route.util";
import { WorkforceApprovalService } from "../platform/workforce/workforce-approval.service";
import { PrismaService } from "../prisma/prisma.service";
import { CommsService } from "../comms/comms.service";
import type {
  AddDocFileDto,
  CreateDocCaseDto,
  CreateDocLocationDto,
  CreateDocTemplateDto,
  DecideDocTaskDto,
  ListDocCasesQuery,
  PatchDocCaseDto,
} from "./dto/documents.dto";

const PREFIX: Record<DocKind, string> = {
  INCOMING: "IN",
  OUTGOING: "OUT",
  INTERNAL: "INT",
};

function bakuYear(date = new Date()): number {
  return new Date(date.getTime() + 4 * 60 * 60 * 1000).getUTCFullYear();
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approval: WorkforceApprovalService,
    private readonly comms: CommsService,
  ) {}

  async lookups(organizationId: string, userId: string) {
    await this.assertMember(organizationId, userId);
    const employments = await this.prisma.workforceEmployment.findMany({
      where: { organizationId, status: WorkforceEmploymentStatus.ACTIVE },
      select: {
        id: true,
        platformUserId: true,
        orgUnit: { select: { id: true, name: true } },
        position: { select: { id: true, name: true, leadership: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 400,
    });
    const units = new Map<string, string>();
    const positions = new Map<string, { id: string; name: string; orgUnitId: string }>();
    for (const row of employments) {
      units.set(row.orgUnit.id, row.orgUnit.name);
      positions.set(row.position.id, {
        id: row.position.id,
        name: row.position.name,
        orgUnitId: row.orgUnit.id,
      });
    }
    return {
      employments: employments.map((row) => ({
        id: row.id,
        platformUserId: row.platformUserId,
        orgUnitId: row.orgUnit.id,
        orgUnitName: row.orgUnit.name,
        positionId: row.position.id,
        positionName: row.position.name,
        leadership: row.position.leadership,
      })),
      orgUnits: [...units.entries()].map(([id, name]) => ({ id, name })),
      positions: [...positions.values()],
    };
  }

  async listCases(organizationId: string, userId: string, query: ListDocCasesQuery) {
    await this.assertMember(organizationId, userId);
    const rows = await this.prisma.docCase.findMany({
      where: {
        organizationId,
        kind: query.kind,
        status: query.status,
        orgUnitId: query.orgUnitId,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        replyTo: { select: { id: true, regNumber: true } },
        location: { select: { id: true, name: true, kind: true } },
        route: {
          select: {
            status: true,
            currentStep: true,
            awaitingAssignment: true,
            tasks: { where: { status: DocTaskStatus.OPEN }, select: { dueAt: true } },
          },
        },
      },
    });
    const today = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const now = new Date();
    return rows.map((row) => ({
      ...row,
      taskOverdue: (row.route?.tasks ?? []).some((task) => task.dueAt != null && task.dueAt < now),
      overdue:
        row.dueOn != null &&
        row.status !== DocStatus.COMPLETED &&
        row.status !== DocStatus.ARCHIVED &&
        row.status !== DocStatus.REJECTED &&
        row.dueOn.toISOString().slice(0, 10) < today,
    }));
  }

  async getCase(organizationId: string, userId: string, caseId: string) {
    await this.assertMember(organizationId, userId);
    const row = await this.prisma.docCase.findFirst({
      where: { id: caseId, organizationId },
      include: {
        files: { orderBy: { createdAt: "asc" } },
        location: true,
        template: { include: { steps: { orderBy: { stepOrder: "asc" } }, edges: true } },
        route: {
          include: {
            tasks: { orderBy: { createdAt: "asc" } },
            decisions: { orderBy: { createdAt: "asc" } },
          },
        },
        replyTo: { select: { id: true, regNumber: true, title: true } },
      },
    });
    if (!row) throw new NotFoundException("Document not found");
    return { ...row, template: row.template ? this.withChain(row.template) : null };
  }

  async createCase(organizationId: string, userId: string, dto: CreateDocCaseDto) {
    await this.assertMember(organizationId, userId);
    await this.assertEmployment(organizationId, dto.authorEmploymentId);
    if (dto.replyToId) await this.mustRegisteredReply(organizationId, userId, dto.replyToId);
    if (dto.templateId) await this.mustTemplate(organizationId, dto.templateId, dto.kind);
    if (dto.locationId) await this.mustLocation(organizationId, dto.locationId);
    const created = await this.prisma.docCase.create({
      data: {
        organizationId,
        kind: dto.kind,
        title: dto.title.trim(),
        correspondent: dto.correspondent?.trim() || null,
        summary: dto.summary?.trim() || null,
        dueOn: dto.dueOn ? new Date(dto.dueOn) : null,
        amount: dto.amount ?? null,
        orgUnitId: dto.orgUnitId ?? null,
        replyToId: dto.replyToId ?? null,
        authorEmploymentId: dto.authorEmploymentId,
        locationId: dto.locationId ?? null,
        templateId: dto.templateId ?? null,
        createdByUserId: userId,
      },
    });
    await this.audit(organizationId, userId, "DOC_CASE_CREATED", created.id, { kind: dto.kind });
    return created;
  }

  async patchCase(organizationId: string, userId: string, caseId: string, dto: PatchDocCaseDto) {
    await this.assertMember(organizationId, userId);
    const existing = await this.getCase(organizationId, userId, caseId);
    if (existing.status !== DocStatus.DRAFT && existing.status !== DocStatus.REGISTERED) {
      throw new BadRequestException({
        code: "DOC_LOCKED",
        message: "Only a draft or registered document can be edited",
      });
    }
    if (dto.replyToId) await this.mustRegisteredReply(organizationId, userId, dto.replyToId, caseId);
    if (dto.templateId) await this.mustTemplate(organizationId, dto.templateId, existing.kind);
    if (dto.locationId) await this.mustLocation(organizationId, dto.locationId);
    const updated = await this.prisma.docCase.update({
      where: { id: caseId },
      data: {
        title: dto.title?.trim(),
        correspondent: dto.correspondent === undefined ? undefined : dto.correspondent?.trim() || null,
        summary: dto.summary === undefined ? undefined : dto.summary?.trim() || null,
        dueOn: dto.dueOn === undefined ? undefined : dto.dueOn ? new Date(dto.dueOn) : null,
        amount: dto.amount === undefined ? undefined : dto.amount,
        orgUnitId: dto.orgUnitId === undefined ? undefined : dto.orgUnitId,
        replyToId: dto.replyToId === undefined ? undefined : dto.replyToId,
        templateId: dto.templateId === undefined ? undefined : dto.templateId,
        locationId: dto.locationId === undefined ? undefined : dto.locationId,
      },
    });
    await this.audit(organizationId, userId, "DOC_CASE_PATCHED", caseId, {});
    return updated;
  }

  async addFile(organizationId: string, userId: string, caseId: string, dto: AddDocFileDto) {
    await this.assertMember(organizationId, userId);
    const existing = await this.getCase(organizationId, userId, caseId);
    if (existing.status !== DocStatus.DRAFT && existing.status !== DocStatus.REGISTERED) {
      throw new BadRequestException({
        code: "DOC_FILE_LOCKED",
        message: "File text can be replaced only before the route starts",
      });
    }
    const file = await this.prisma.docFile.create({
      data: {
        caseId,
        fileName: dto.fileName.trim(),
        contentType: dto.contentType?.trim() || "text/plain",
        body: dto.body ?? null,
      },
    });
    await this.audit(organizationId, userId, "DOC_FILE_ADDED", caseId, { fileId: file.id });
    return file;
  }

  async replaceFile(organizationId: string, userId: string, caseId: string, fileId: string, body: string) {
    await this.assertMember(organizationId, userId);
    const existing = await this.getCase(organizationId, userId, caseId);
    if (existing.status !== DocStatus.DRAFT && existing.status !== DocStatus.REGISTERED) {
      throw new BadRequestException({
        code: "DOC_FILE_LOCKED",
        message: "File text can be replaced only before the route starts",
      });
    }
    const file = existing.files.find((row) => row.id === fileId);
    if (!file) throw new NotFoundException("File not found");
    const updated = await this.prisma.docFile.update({
      where: { id: fileId },
      data: { body },
    });
    await this.audit(organizationId, userId, "DOC_FILE_REPLACED", caseId, { fileId });
    return updated;
  }

  async register(organizationId: string, userId: string, caseId: string) {
    await this.assertMember(organizationId, userId);
    const existing = await this.getCase(organizationId, userId, caseId);
    if (existing.status !== DocStatus.DRAFT) {
      throw new BadRequestException({
        code: "DOC_NOT_DRAFT",
        message: "Only a draft can be registered",
      });
    }
    const year = bakuYear();
    const prefix = `${PREFIX[existing.kind]}-${year}-`;
    const updated = await this.prisma.$transaction(async (tx) => {
      const count = await tx.docCase.count({
        where: { organizationId, kind: existing.kind, regNumber: { startsWith: prefix } },
      });
      const regNumber = `${prefix}${String(count + 1).padStart(4, "0")}`;
      return tx.docCase.update({
        where: { id: caseId },
        data: { status: DocStatus.REGISTERED, regNumber, registeredAt: new Date() },
      });
    });
    await this.audit(organizationId, userId, "DOC_REGISTERED", caseId, { regNumber: updated.regNumber });
    return updated;
  }

  async start(organizationId: string, userId: string, caseId: string, templateId?: string) {
    await this.assertMember(organizationId, userId);
    const existing = await this.getCase(organizationId, userId, caseId);
    if (existing.status !== DocStatus.REGISTERED) {
      throw new BadRequestException({
        code: "DOC_NOT_REGISTERED",
        message: "Register the document before starting a route",
      });
    }
    if (existing.route) {
      throw new BadRequestException({
        code: "DOC_ROUTE_ALREADY_STARTED",
        message: "This document already has a route",
      });
    }
    const chosen = templateId ?? existing.templateId;
    if (!chosen) {
      throw new BadRequestException({
        code: "DOC_TEMPLATE_REQUIRED",
        message: "Choose a route template",
      });
    }
    const template = await this.mustTemplate(organizationId, chosen, existing.kind);
    const leadership = await this.leadership(existing.authorEmploymentId);
    const steps = template.steps.filter((step) => stepApplies(step.appliesTo, leadership));
    if (steps.length === 0) {
      throw new BadRequestException({
        code: "DOC_ROUTE_EMPTY",
        message: "No route step applies to the author",
      });
    }
    const opened = await this.openAt(organizationId, existing, steps, 0);
    const instance = await this.prisma.$transaction(async (tx) => {
      const created = await tx.docRouteInstance.create({
        data: {
          organizationId,
          caseId,
          templateId: template.id,
          currentStep: opened.step?.stepOrder ?? steps[steps.length - 1]!.stepOrder,
          status: opened.done ? DocRouteInstanceStatus.COMPLETED : DocRouteInstanceStatus.OPEN,
          awaitingAssignment: opened.unassigned,
          tasks: opened.assignees.length
            ? {
                create: opened.assignees.map((seat) => ({
                  stepOrder: opened.step!.stepOrder,
                  action: opened.step!.action,
                  assigneeEmploymentId: seat.employmentId!,
                  assigneeUserId: seat.userId,
                  dueAt: opened.dueAt,
                })),
              }
            : undefined,
        },
        include: { tasks: true },
      });
      await tx.docCase.update({
        where: { id: caseId },
        data: {
          status: opened.done ? DocStatus.COMPLETED : DocStatus.IN_ROUTE,
          templateId: template.id,
        },
      });
      return created;
    });
    await this.audit(organizationId, userId, "DOC_ROUTE_STARTED", caseId, {
      step: opened.step?.stepOrder ?? null,
      unassigned: opened.unassigned,
    });
    if (opened.assignees.length) {
      await this.notifyAssignees(
        organizationId,
        userId,
        existing.title,
        existing.regNumber,
        opened.assignees.map((seat) => seat.userId),
        "assigned",
      );
    }
    return instance;
  }

  async decide(organizationId: string, userId: string, taskId: string, dto: DecideDocTaskDto) {
    await this.assertMember(organizationId, userId);
    if (dto.outcome === DocDecisionOutcome.REJECTED && !(dto.reason ?? "").trim()) {
      throw new BadRequestException({
        code: "DOC_REJECT_REASON_REQUIRED",
        message: "A rejection needs a reason",
      });
    }
    const task = await this.prisma.docRouteTask.findFirst({
      where: { id: taskId, instance: { organizationId } },
      include: {
        instance: {
          include: {
            case: true,
            template: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
          },
        },
      },
    });
    if (!task || task.status !== DocTaskStatus.OPEN) {
      throw new NotFoundException("Open task not found");
    }
    const allowed = await this.approval.actorIsAssignee(organizationId, userId, [
      {
        employmentId: task.assigneeEmploymentId,
        userId: task.assigneeUserId,
        orgUnitId: "",
        orgUnitName: "",
      },
    ]);
    if (!allowed) {
      throw new ForbiddenException({
        code: "APPROVAL_STEP_FORBIDDEN",
        message: "This approval step belongs to another org-structure seat",
      });
    }
    if (
      task.action === DocStepAction.ACKNOWLEDGE &&
      dto.outcome === DocDecisionOutcome.APPROVED
    ) {
      dto = { ...dto, outcome: DocDecisionOutcome.ACKNOWLEDGED };
    }
    const doc = task.instance.case;
    const leadership = await this.leadership(doc.authorEmploymentId);
    const steps = task.instance.template.steps.filter((step) =>
      stepApplies(step.appliesTo, leadership),
    );
    const current = steps.find((step) => step.stepOrder === task.stepOrder);
    const join = current?.join ?? DocStepJoin.ANY;
    const openSiblings = await this.prisma.docRouteTask.count({
      where: {
        instanceId: task.instanceId,
        stepOrder: task.stepOrder,
        status: DocTaskStatus.OPEN,
        NOT: { id: task.id },
      },
    });
    const waitForAll = join === DocStepJoin.ALL && dto.outcome !== DocDecisionOutcome.REJECTED && openSiblings > 0;
    let reopen: {
      step: (typeof steps)[number];
      assignees: Awaited<ReturnType<WorkforceApprovalService["resolveStepAssignees"]>>;
      dueAt: Date;
    } | null = null;
    if (dto.outcome === DocDecisionOutcome.REJECTED && dto.returnToStep != null) {
      const target = steps.find((step) => step.stepOrder === dto.returnToStep);
      if (!target || target.stepOrder >= task.stepOrder) {
        throw new BadRequestException({
          code: "DOC_RETURN_STEP",
          message: "Return only to an earlier step of this route",
        });
      }
      reopen = {
        step: target,
        assignees: await this.approval.resolveStepAssignees(organizationId, doc.authorEmploymentId, target),
        dueAt: new Date(Date.now() + target.dueDays * 24 * 60 * 60 * 1000),
      };
    }
    const opened = waitForAll || dto.outcome === DocDecisionOutcome.REJECTED
      ? null
      : await this.openAt(organizationId, doc, steps, task.stepOrder);
    await this.prisma.$transaction(async (tx) => {
      await tx.docRouteDecision.create({
        data: {
          instanceId: task.instanceId,
          stepOrder: task.stepOrder,
          outcome: dto.outcome,
          actorUserId: userId,
          reason: dto.reason?.trim() || null,
        },
      });
      if (dto.outcome === DocDecisionOutcome.REJECTED || join !== DocStepJoin.ALL) {
        await tx.docRouteTask.updateMany({
          where: { instanceId: task.instanceId, stepOrder: task.stepOrder, status: DocTaskStatus.OPEN },
          data: {
            status: dto.outcome === DocDecisionOutcome.REJECTED ? DocTaskStatus.CANCELLED : DocTaskStatus.DONE,
          },
        });
      } else {
        await tx.docRouteTask.update({
          where: { id: task.id },
          data: { status: DocTaskStatus.DONE },
        });
      }
      if (dto.outcome === DocDecisionOutcome.REJECTED) {
        if (reopen) {
          await tx.docRouteInstance.update({
            where: { id: task.instanceId },
            data: {
              status: DocRouteInstanceStatus.OPEN,
              currentStep: reopen.step.stepOrder,
              awaitingAssignment: reopen.assignees.length === 0,
            },
          });
          if (reopen.assignees.length) {
            await tx.docRouteTask.createMany({
              data: reopen.assignees.map((seat) => ({
                instanceId: task.instanceId,
                stepOrder: reopen.step.stepOrder,
                action: reopen.step.action,
                assigneeEmploymentId: seat.employmentId!,
                assigneeUserId: seat.userId,
                dueAt: reopen.dueAt,
              })),
            });
          }
          return;
        }
        await tx.docRouteInstance.update({
          where: { id: task.instanceId },
          data: { status: DocRouteInstanceStatus.REJECTED, awaitingAssignment: false },
        });
        await tx.docCase.update({ where: { id: doc.id }, data: { status: DocStatus.REJECTED } });
        return;
      }
      if (waitForAll || !opened) return;
      if (opened.done) {
        await tx.docRouteInstance.update({
          where: { id: task.instanceId },
          data: { status: DocRouteInstanceStatus.COMPLETED, awaitingAssignment: false },
        });
        await tx.docCase.update({ where: { id: doc.id }, data: { status: DocStatus.COMPLETED } });
        return;
      }
      await tx.docRouteInstance.update({
        where: { id: task.instanceId },
        data: { currentStep: opened.step!.stepOrder, awaitingAssignment: opened.unassigned },
      });
      if (opened.assignees.length) {
        await tx.docRouteTask.createMany({
          data: opened.assignees.map((seat) => ({
            instanceId: task.instanceId,
            stepOrder: opened.step!.stepOrder,
            action: opened.step!.action,
            assigneeEmploymentId: seat.employmentId!,
            assigneeUserId: seat.userId,
            dueAt: opened.dueAt,
          })),
        });
      }
    });
    await this.audit(organizationId, userId, "DOC_TASK_DECIDED", doc.id, { outcome: dto.outcome });
    if (dto.outcome === DocDecisionOutcome.REJECTED && reopen) {
      await this.notifyAssignees(
        organizationId,
        userId,
        doc.title,
        doc.regNumber,
        reopen.assignees.map((seat) => seat.userId),
        "assigned",
      );
    } else if (dto.outcome === DocDecisionOutcome.REJECTED) {
      const author = await this.prisma.workforceEmployment.findFirst({
        where: { id: doc.authorEmploymentId },
        select: { platformUserId: true },
      });
      await this.notifyAssignees(organizationId, userId, doc.title, doc.regNumber, [author?.platformUserId ?? null], "returned");
    } else if (opened?.assignees.length) {
      await this.notifyAssignees(
        organizationId,
        userId,
        doc.title,
        doc.regNumber,
        opened.assignees.map((seat) => seat.userId),
        "assigned",
      );
    }
    return this.getCase(organizationId, userId, doc.id);
  }

  async assign(organizationId: string, userId: string, caseId: string, employmentId: string) {
    await this.assertMember(organizationId, userId);
    const instance = await this.prisma.docRouteInstance.findFirst({
      where: { caseId, organizationId },
      include: { case: true, template: { include: { steps: true } } },
    });
    if (!instance?.awaitingAssignment) {
      throw new BadRequestException({
        code: "DOC_ASSIGN_NOT_WAITING",
        message: "This route is not waiting for a manual assignee",
      });
    }
    const employment = await this.prisma.workforceEmployment.findFirst({
      where: { id: employmentId, organizationId, status: WorkforceEmploymentStatus.ACTIVE },
      select: { id: true, platformUserId: true },
    });
    if (!employment) {
      throw new BadRequestException({
        code: "DOC_AUTHOR_NOT_IN_ORG",
        message: "Assignee employment is not active in this organization",
      });
    }
    const step = instance.template.steps.find((row) => row.stepOrder === instance.currentStep);
    if (!step) throw new NotFoundException("Route step not found");
    const dueAt = new Date(Date.now() + step.dueDays * 24 * 60 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.docRouteTask.create({
        data: {
          instanceId: instance.id,
          stepOrder: step.stepOrder,
          action: step.action,
          assigneeEmploymentId: employment.id,
          assigneeUserId: employment.platformUserId,
          dueAt,
        },
      });
      await tx.docRouteInstance.update({
        where: { id: instance.id },
        data: { awaitingAssignment: false },
      });
    });
    await this.audit(organizationId, userId, "DOC_STEP_ASSIGNED", caseId, { employmentId });
    await this.notifyAssignees(
      organizationId,
      userId,
      instance.case.title,
      instance.case.regNumber,
      [employment.platformUserId],
      "assigned",
    );
    return this.getCase(organizationId, userId, caseId);
  }

  async listOverdue(organizationId: string, userId: string) {
    await this.assertMember(organizationId, userId);
    return this.prisma.docRouteTask.findMany({
      where: {
        status: DocTaskStatus.OPEN,
        dueAt: { lt: new Date() },
        instance: { organizationId, status: DocRouteInstanceStatus.OPEN },
      },
      orderBy: { dueAt: "asc" },
      include: {
        instance: { select: { case: { select: { id: true, title: true, regNumber: true } } } },
      },
    });
  }

  /** One Comms notice per overdue task. A failed send leaves the stamp empty for the next day. */
  async notifyOverdue(): Promise<number> {
    const tasks = await this.prisma.docRouteTask.findMany({
      where: {
        status: DocTaskStatus.OPEN,
        overdueNotifiedAt: null,
        dueAt: { lt: new Date() },
        instance: { status: DocRouteInstanceStatus.OPEN },
      },
      include: { instance: { include: { case: true } } },
      take: 200,
    });
    let sent = 0;
    for (const task of tasks) {
      const doc = task.instance.case;
      const ok = await this.notifyAssignees(
        doc.organizationId,
        doc.createdByUserId,
        doc.title,
        doc.regNumber,
        [task.assigneeUserId],
        "overdue",
      );
      if (!ok) continue;
      await this.prisma.docRouteTask.update({
        where: { id: task.id },
        data: { overdueNotifiedAt: new Date() },
      });
      sent += 1;
    }
    return sent;
  }

  async archive(organizationId: string, userId: string, caseId: string, locationId?: string) {
    await this.assertMember(organizationId, userId);
    const existing = await this.getCase(organizationId, userId, caseId);
    if (existing.status !== DocStatus.COMPLETED && existing.status !== DocStatus.REJECTED) {
      throw new BadRequestException({
        code: "DOC_NOT_ARCHIVABLE",
        message: "Archive a completed or rejected document",
      });
    }
    if (locationId) await this.mustLocation(organizationId, locationId);
    const updated = await this.prisma.docCase.update({
      where: { id: caseId },
      data: { status: DocStatus.ARCHIVED, locationId: locationId ?? existing.locationId },
    });
    await this.audit(organizationId, userId, "DOC_ARCHIVED", caseId, { locationId: locationId ?? null });
    return updated;
  }

  async myTasks(organizationId: string, userId: string) {
    await this.assertMember(organizationId, userId);
    return this.prisma.docRouteTask.findMany({
      where: {
        status: DocTaskStatus.OPEN,
        assigneeUserId: userId,
        instance: { organizationId },
      },
      orderBy: { dueAt: "asc" },
      include: {
        instance: {
          select: {
            currentStep: true,
            case: {
              select: { id: true, title: true, regNumber: true, kind: true, dueOn: true, status: true },
            },
            template: { select: { steps: { select: { stepOrder: true }, orderBy: { stepOrder: "asc" } } } },
          },
        },
      },
    });
  }

  async listLocations(organizationId: string, userId: string) {
    await this.assertMember(organizationId, userId);
    return this.prisma.docLocation.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async createLocation(organizationId: string, userId: string, dto: CreateDocLocationDto) {
    await this.assertMember(organizationId, userId);
    if (dto.parentId) await this.mustLocation(organizationId, dto.parentId);
    const row = await this.prisma.docLocation.create({
      data: {
        organizationId,
        kind: dto.kind,
        name: dto.name.trim(),
        parentId: dto.parentId ?? null,
      },
    });
    await this.audit(organizationId, userId, "DOC_LOCATION_CREATED", row.id, { kind: dto.kind });
    return row;
  }

  async deleteLocation(organizationId: string, userId: string, locationId: string) {
    await this.assertMember(organizationId, userId);
    await this.mustLocation(organizationId, locationId);
    const [children, cases] = await Promise.all([
      this.prisma.docLocation.count({ where: { parentId: locationId } }),
      this.prisma.docCase.count({ where: { locationId } }),
    ]);
    if (children > 0 || cases > 0) {
      throw new BadRequestException({
        code: "DOC_LOCATION_IN_USE",
        message: "Location still has children or documents",
      });
    }
    await this.prisma.docLocation.delete({ where: { id: locationId } });
    await this.audit(organizationId, userId, "DOC_LOCATION_DELETED", locationId, {});
    return { ok: true };
  }

  async listTemplates(organizationId: string, userId: string) {
    await this.assertMember(organizationId, userId);
    return this.prisma.docRouteTemplate.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: { steps: { orderBy: { stepOrder: "asc" } }, edges: true },
    }).then((rows) => rows.map((row) => this.withChain(row)));
  }

  async createTemplate(organizationId: string, userId: string, dto: CreateDocTemplateDto) {
    await this.assertMember(organizationId, userId);
    const orders = dto.steps.map((step) => step.stepOrder);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException({
        code: "DOC_STEP_ORDER_DUPLICATE",
        message: "Step order must be unique",
      });
    }
    const edges = chainEdges(orders);
    if (!edges) {
      throw new BadRequestException({
        code: "DOC_ROUTE_GAP",
        message: "Route steps must be one chain starting at 1",
      });
    }
    const row = await this.prisma.docRouteTemplate.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        docKind: dto.docKind,
        steps: {
          create: dto.steps.map((step) => ({
            stepOrder: step.stepOrder,
            kind: step.kind,
            action: step.action,
            appliesTo: step.appliesTo ?? "ALWAYS",
            dueDays: step.dueDays ?? 3,
            join: step.join ?? "ANY",
            skipUnlessKind: step.skipUnlessKind ?? null,
            minAmount: step.minAmount ?? null,
            chainOffset: step.chainOffset ?? null,
            minGradeLevel: step.minGradeLevel ?? null,
            orgUnitId: step.orgUnitId ?? null,
            positionId: step.positionId ?? null,
            layoutX: step.layoutX ?? null,
            layoutY: step.layoutY ?? null,
          })),
        },
        edges: { create: edges },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } }, edges: true },
    });
    await this.audit(organizationId, userId, "DOC_TEMPLATE_CREATED", row.id, { docKind: dto.docKind });
    return row;
  }

  /** Positions only. Step meaning stays on the step row. */
  async saveLayout(
    organizationId: string,
    userId: string,
    templateId: string,
    points: Array<{ stepOrder: number; layoutX: number; layoutY: number }>,
  ) {
    await this.assertMember(organizationId, userId);
    const template = await this.mustTemplate(organizationId, templateId);
    const known = new Set(template.steps.map((step) => step.stepOrder));
    if (points.some((point) => !known.has(point.stepOrder))) {
      throw new BadRequestException({
        code: "DOC_LAYOUT_STEP",
        message: "Layout point does not match a route step",
      });
    }
    await this.prisma.$transaction(
      points.map((point) =>
        this.prisma.docRouteStep.updateMany({
          where: { templateId, stepOrder: point.stepOrder },
          data: { layoutX: point.layoutX, layoutY: point.layoutY },
        }),
      ),
    );
    await this.audit(organizationId, userId, "DOC_TEMPLATE_LAYOUT", templateId, { count: points.length });
    return this.mustTemplate(organizationId, templateId);
  }

  async updateTemplate(organizationId: string, userId: string, templateId: string, dto: CreateDocTemplateDto) {
    await this.assertMember(organizationId, userId);
    const orders = dto.steps.map((step) => step.stepOrder);
    const edges = chainEdges(orders);
    if (!edges || new Set(orders).size !== orders.length) {
      throw new BadRequestException({
        code: "DOC_ROUTE_GAP",
        message: "Route steps must be one chain starting at 1",
      });
    }
    const open = await this.prisma.docRouteInstance.count({
      where: { templateId, organizationId, status: DocRouteInstanceStatus.OPEN },
    });
    if (open > 0) {
      throw new BadRequestException({
        code: "DOC_TEMPLATE_IN_USE",
        message: "Template has an open route; only the layout can change",
      });
    }
    const existing = await this.mustTemplate(organizationId, templateId);
    const layout = new Map(existing.steps.map((step) => [step.stepOrder, { x: step.layoutX, y: step.layoutY }]));
    await this.prisma.$transaction([
      this.prisma.docRouteEdge.deleteMany({ where: { templateId } }),
      this.prisma.docRouteStep.deleteMany({ where: { templateId } }),
      this.prisma.docRouteTemplate.update({
        where: { id: templateId },
        data: {
          name: dto.name.trim(),
          docKind: dto.docKind,
          steps: {
            create: dto.steps.map((step) => ({
              stepOrder: step.stepOrder,
              kind: step.kind,
              action: step.action,
              appliesTo: step.appliesTo ?? "ALWAYS",
              dueDays: step.dueDays ?? 3,
              join: step.join ?? "ANY",
              skipUnlessKind: step.skipUnlessKind ?? null,
              minAmount: step.minAmount ?? null,
              chainOffset: step.chainOffset ?? null,
              minGradeLevel: step.minGradeLevel ?? null,
              orgUnitId: step.orgUnitId ?? null,
              positionId: step.positionId ?? null,
              layoutX: step.layoutX ?? layout.get(step.stepOrder)?.x ?? null,
              layoutY: step.layoutY ?? layout.get(step.stepOrder)?.y ?? null,
            })),
          },
          edges: { create: edges },
        },
      }),
    ]);
    await this.audit(organizationId, userId, "DOC_TEMPLATE_UPDATED", templateId, {});
    return this.mustTemplate(organizationId, templateId);
  }

  async deleteTemplate(organizationId: string, userId: string, templateId: string) {
    await this.assertMember(organizationId, userId);
    const used = await this.prisma.docRouteInstance.count({ where: { templateId, organizationId } });
    if (used > 0) {
      throw new BadRequestException({
        code: "DOC_TEMPLATE_IN_USE",
        message: "Template is used by a started route",
      });
    }
    await this.mustTemplate(organizationId, templateId);
    await this.prisma.docRouteTemplate.delete({ where: { id: templateId } });
    await this.audit(organizationId, userId, "DOC_TEMPLATE_DELETED", templateId, {});
    return { ok: true };
  }

  private async openAt(
    organizationId: string,
    doc: { kind: DocKind; amount: { toString(): string } | null; authorEmploymentId: string },
    steps: Array<{
      stepOrder: number;
      action: DocStepAction;
      dueDays: number;
      join: DocStepJoin;
      skipUnlessKind: DocKind | null;
      minAmount: { toString(): string } | null;
      kind: import("@era365/database").WorkforceApprovalStepKind;
      orgUnitId: string | null;
      positionId: string | null;
      chainOffset: number | null;
      minGradeLevel: number | null;
    }>,
    afterOrder: number,
  ) {
    const runnable = steps.filter((step) => step.stepOrder > afterOrder && !stepSkipped(step, doc));
    if (runnable.length === 0) {
      return { done: true, unassigned: false, step: null, assignees: [], dueAt: null as Date | null };
    }
    const step = runnable[0]!;
    const assignees = await this.approval.resolveStepAssignees(organizationId, doc.authorEmploymentId, step);
    return {
      done: false,
      unassigned: assignees.length === 0,
      step,
      assignees,
      dueAt: new Date(Date.now() + step.dueDays * 24 * 60 * 60 * 1000),
    };
  }

  private withChain<T extends { steps: Array<{ stepOrder: number }>; edges: Array<{ fromStepOrder: number | null; toStepOrder: number }> }>(row: T): T {
    if (row.edges?.length) return row;
    return { ...row, edges: chainEdges(row.steps.map((step) => step.stepOrder)) ?? [] };
  }

  private async leadership(employmentId: string): Promise<boolean> {
    const emp = await this.prisma.workforceEmployment.findFirst({
      where: { id: employmentId },
      select: { position: { select: { leadership: true } } },
    });
    return emp?.position?.leadership === true;
  }

  private async assertMember(organizationId: string, userId: string) {
    const member = await this.prisma.organizationMembership.findFirst({
      where: { organizationId, userId, deletedAt: null },
      select: { userId: true },
    });
    if (!member) throw new ForbiddenException("Organization membership required");
  }

  private async assertEmployment(organizationId: string, employmentId: string) {
    const emp = await this.prisma.workforceEmployment.findFirst({
      where: { id: employmentId, organizationId, status: WorkforceEmploymentStatus.ACTIVE },
      select: { id: true },
    });
    if (!emp) {
      throw new BadRequestException({
        code: "DOC_AUTHOR_NOT_IN_ORG",
        message: "Author employment is not active in this organization",
      });
    }
  }

  private async mustRegisteredReply(organizationId: string, userId: string, replyToId: string, caseId?: string) {
    if (caseId && replyToId === caseId) {
      throw new BadRequestException({
        code: "DOC_REPLY_SELF",
        message: "A document cannot reply to itself",
      });
    }
    const target = await this.getCase(organizationId, userId, replyToId);
    if (!target.regNumber) {
      throw new BadRequestException({
        code: "DOC_REPLY_UNREGISTERED",
        message: "Reply only to a registered document",
      });
    }
  }

  private async mustTemplate(organizationId: string, templateId: string, kind?: DocKind) {
    const row = await this.prisma.docRouteTemplate.findFirst({
      where: { id: templateId, organizationId },
      include: { steps: { orderBy: { stepOrder: "asc" } }, edges: true },
    });
    if (!row || (kind && row.docKind !== kind)) {
      throw new BadRequestException({
        code: "DOC_TEMPLATE_MISMATCH",
        message: "Route template is missing or belongs to another document kind",
      });
    }
    return row;
  }

  private async mustLocation(organizationId: string, locationId: string) {
    const row = await this.prisma.docLocation.findFirst({
      where: { id: locationId, organizationId },
    });
    if (!row) throw new NotFoundException("Location not found");
    return row;
  }

  private async notifyAssignees(
    organizationId: string,
    actorUserId: string,
    title: string,
    regNumber: string | null,
    userIds: Array<string | null>,
    mode: "assigned" | "returned" | "overdue",
  ) {
    const recipientUserIds = [...new Set(userIds.filter((id): id is string => Boolean(id && id !== actorUserId)))];
    if (recipientUserIds.length === 0) return true;
    const subject =
      mode === "returned"
        ? `Document returned: ${title}`
        : mode === "overdue"
          ? `Document overdue: ${title}`
          : `Document task: ${title}`;
    const body = regNumber
      ? `${regNumber}. Open Documents in the workspace.`
      : "Open Documents in the workspace.";
    try {
      await this.comms.createThread(organizationId, actorUserId, { subject, body, recipientUserIds });
      return true;
    } catch {
      return false;
    }
  }

  private async audit(
    organizationId: string,
    userId: string,
    action: string,
    entityId: string,
    payload: Prisma.InputJsonValue,
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: "doc.case",
        entityId,
        action,
        newValues: payload,
      },
    });
  }
}
