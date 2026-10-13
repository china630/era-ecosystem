import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  WorkforceAbsenceKind,
  WorkforceApprovalOutcome,
  WorkforceApprovalRequestKind,
  WorkforceApprovalStepKind,
  WorkforceEmploymentStatus,
} from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import {
  resolveRequesterManager,
  type OrgUnitNode,
  type ResolvedAssignee,
} from "./workforce-approval.resolve";

export type ApprovalEntityType = "ABSENCE" | "HOURLY" | "ADVANCE" | "VACATION_PLAN";

export type ApprovalLabel = {
  configured: boolean;
  stepOrder: number;
  stepKind: WorkforceApprovalStepKind | null;
  orgUnitId: string | null;
  orgUnitName: string | null;
};

type GateResult =
  | { action: "final" }
  | { action: "advance"; nextStep: number };

@Injectable()
export class WorkforceApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  kindForAbsence(kind: WorkforceAbsenceKind | string): WorkforceApprovalRequestKind {
    return kind === WorkforceAbsenceKind.VACATION
      ? WorkforceApprovalRequestKind.VACATION
      : WorkforceApprovalRequestKind.FULL_DAY;
  }

  async gate(input: {
    organizationId: string;
    kind: WorkforceApprovalRequestKind;
    employmentId: string;
    stepOrder: number;
    actorUserId: string;
    entityType: ApprovalEntityType;
    entityId: string;
  }): Promise<GateResult> {
    const placed = await this.placeActor(input);
    if (!placed) return { action: "final" };
    await this.record({
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      stepOrder: placed.stepOrder,
      stepKind: placed.stepKind,
      orgUnitId: placed.orgUnitId,
      orgUnitName: placed.orgUnitName,
      outcome: WorkforceApprovalOutcome.APPROVED,
      actorUserId: input.actorUserId,
    });
    if (!placed.hasLater) return { action: "final" };
    return { action: "advance", nextStep: placed.nextStep };
  }

  /** Null when the org has no route — any permitted HR user may decide. */
  private async placeActor(input: {
    organizationId: string;
    kind: WorkforceApprovalRequestKind;
    employmentId: string;
    stepOrder: number;
    actorUserId: string;
  }): Promise<{
    stepOrder: number;
    stepKind: WorkforceApprovalStepKind;
    orgUnitId: string | null;
    orgUnitName: string | null;
    hasLater: boolean;
    nextStep: number;
  } | null> {
    const route = await this.loadRoute(input.organizationId, input.kind);
    const steps = route?.steps ?? [];
    if (steps.length === 0) return null;
    const index = Math.max(0, input.stepOrder);
    const step = steps.find((s) => s.stepOrder === index) ?? steps[index];
    if (!step) return null;
    const assignees = await this.assignees(
      input.organizationId,
      input.employmentId,
      step.kind,
      step.orgUnitId,
      step.positionId,
    );
    if (assignees.length === 0) {
      throw new BadRequestException({
        code: "APPROVAL_STEP_UNASSIGNED",
        message: "Approval step has no assignee in the org structure",
      });
    }
    const allowed = await this.actorMatches(
      input.organizationId,
      input.actorUserId,
      assignees,
    );
    if (!allowed) {
      throw new ForbiddenException({
        code: "APPROVAL_STEP_FORBIDDEN",
        message: "This approval step belongs to another org-structure seat",
      });
    }
    const primary = assignees[0];
    const laterOrders = steps
      .map((s) => s.stepOrder)
      .filter((n) => n > step.stepOrder)
      .sort((a, b) => a - b);
    return {
      stepOrder: step.stepOrder,
      stepKind: step.kind,
      orgUnitId: primary?.orgUnitId ?? step.orgUnitId,
      orgUnitName: primary?.orgUnitName ?? null,
      hasLater: laterOrders.length > 0,
      nextStep: laterOrders[0] ?? step.stepOrder + 1,
    };
  }

  async rejectStep(input: {
    organizationId: string;
    kind: WorkforceApprovalRequestKind;
    employmentId: string;
    stepOrder: number;
    actorUserId: string;
    entityType: ApprovalEntityType;
    entityId: string;
    reason?: string | null;
  }): Promise<void> {
    const placed = await this.placeActor(input);
    if (!placed) return;
    await this.record({
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      stepOrder: placed.stepOrder,
      stepKind: placed.stepKind,
      orgUnitId: placed.orgUnitId,
      orgUnitName: placed.orgUnitName,
      outcome: WorkforceApprovalOutcome.REJECTED,
      actorUserId: input.actorUserId,
      reason: input.reason,
    });
  }

  async recordOutcome(input: {
    organizationId: string;
    entityType: ApprovalEntityType;
    entityId: string;
    stepOrder: number;
    outcome: WorkforceApprovalOutcome;
    actorUserId: string;
    reason?: string | null;
    orgUnitName?: string | null;
  }): Promise<void> {
    await this.record({
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      stepOrder: input.stepOrder,
      stepKind: null,
      orgUnitId: null,
      orgUnitName: input.orgUnitName ?? null,
      outcome: input.outcome,
      actorUserId: input.actorUserId,
      reason: input.reason,
    });
  }

  async labelFor(
    organizationId: string,
    kind: WorkforceApprovalRequestKind,
    employmentId: string,
    stepOrder: number,
  ): Promise<ApprovalLabel> {
    const route = await this.loadRoute(organizationId, kind);
    const steps = route?.steps ?? [];
    if (steps.length === 0) {
      return {
        configured: false,
        stepOrder,
        stepKind: null,
        orgUnitId: null,
        orgUnitName: null,
      };
    }
    const step = steps.find((s) => s.stepOrder === stepOrder) ?? steps[stepOrder];
    if (!step) {
      return {
        configured: true,
        stepOrder,
        stepKind: null,
        orgUnitId: null,
        orgUnitName: null,
      };
    }
    const assignees = await this.assignees(
      organizationId,
      employmentId,
      step.kind,
      step.orgUnitId,
      step.positionId,
    );
    return {
      configured: true,
      stepOrder: step.stepOrder,
      stepKind: step.kind,
      orgUnitId: assignees[0]?.orgUnitId ?? step.orgUnitId,
      orgUnitName: assignees[0]?.orgUnitName ?? step.orgUnit?.name ?? null,
    };
  }

  async recent(organizationId: string) {
    return this.prisma.workforceApprovalDecision.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
  }

  private async loadRoute(
    organizationId: string,
    kind: WorkforceApprovalRequestKind,
  ) {
    return this.prisma.workforceApprovalRoute.findUnique({
      where: { organizationId_kind: { organizationId, kind } },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
          include: { orgUnit: { select: { id: true, name: true } } },
        },
      },
    });
  }

  private async assignees(
    organizationId: string,
    employmentId: string,
    kind: WorkforceApprovalStepKind,
    orgUnitId: string | null,
    positionId: string | null,
  ): Promise<ResolvedAssignee[]> {
    const employment = await this.prisma.workforceEmployment.findFirst({
      where: { id: employmentId, organizationId },
      select: { id: true, orgUnitId: true, workforceScopeId: true },
    });
    if (!employment) return [];
    const units = await this.units(employment.workforceScopeId);
    if (kind === WorkforceApprovalStepKind.REQUESTER_MANAGER) {
      const hit = resolveRequesterManager({
        startOrgUnitId: employment.orgUnitId,
        requesterEmploymentId: employment.id,
        units,
      });
      return hit ? [hit] : [];
    }
    const unit = units.find((u) => u.id === orgUnitId);
    if (!unit) return [];
    if (kind === WorkforceApprovalStepKind.ORG_UNIT_HEAD) {
      if (!unit.managerEmploymentId && !unit.managerUserId) return [];
      return [
        {
          employmentId: unit.managerEmploymentId,
          userId: unit.managerUserId,
          orgUnitId: unit.id,
          orgUnitName: unit.name,
        },
      ];
    }
    if (!positionId) return [];
    const seats = await this.prisma.workforceEmployment.findMany({
      where: {
        organizationId,
        orgUnitId: unit.id,
        positionId,
        status: WorkforceEmploymentStatus.ACTIVE,
        NOT: { id: employment.id },
      },
      select: { id: true, platformUserId: true },
    });
    return seats.map((seat) => ({
      employmentId: seat.id,
      userId: seat.platformUserId,
      orgUnitId: unit.id,
      orgUnitName: unit.name,
    }));
  }

  private async units(workforceScopeId: string): Promise<OrgUnitNode[]> {
    const rows = await this.prisma.orgUnit.findMany({
      where: { workforceScopeId },
      select: {
        id: true,
        parentId: true,
        name: true,
        managerEmploymentId: true,
        managerUserId: true,
      },
    });
    return rows;
  }

  private async actorMatches(
    organizationId: string,
    actorUserId: string,
    assignees: ResolvedAssignee[],
  ): Promise<boolean> {
    if (assignees.some((a) => a.userId && a.userId === actorUserId)) return true;
    const empIds = assignees
      .map((a) => a.employmentId)
      .filter((id): id is string => Boolean(id));
    if (empIds.length === 0) return false;
    const owned = await this.prisma.workforceEmployment.findFirst({
      where: {
        organizationId,
        id: { in: empIds },
        platformUserId: actorUserId,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
      select: { id: true },
    });
    return Boolean(owned);
  }

  private async record(input: {
    organizationId: string;
    entityType: string;
    entityId: string;
    stepOrder: number;
    stepKind: WorkforceApprovalStepKind | null;
    orgUnitId: string | null;
    orgUnitName: string | null;
    outcome: WorkforceApprovalOutcome;
    actorUserId: string;
    reason?: string | null;
  }): Promise<void> {
    await this.prisma.workforceApprovalDecision.create({
      data: {
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        stepOrder: input.stepOrder,
        stepKind: input.stepKind,
        orgUnitId: input.orgUnitId,
        orgUnitName: input.orgUnitName,
        outcome: input.outcome,
        actorUserId: input.actorUserId,
        reason: (input.reason ?? "").trim() || null,
      },
    });
  }
}
