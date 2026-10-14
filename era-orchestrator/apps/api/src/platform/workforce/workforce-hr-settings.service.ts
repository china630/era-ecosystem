import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@era365/database";
import {
  WorkforceApprovalRequestKind,
  WorkforceApprovalStepAudience,
  WorkforceApprovalStepKind,
  WorkforceSelfRequestStatus,
} from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { FinanceWorkforceMirrorClient } from "./finance-workforce-mirror.client";
import { WorkforceScopeService } from "./workforce-scope.service";
import { stepApplies } from "./workforce-approval.resolve";

const KINDS = new Set<string>(Object.values(WorkforceApprovalRequestKind));
const STEP_KINDS = new Set<string>(Object.values(WorkforceApprovalStepKind));
const AUDIENCES = new Set(["ALWAYS", "LEADERSHIP", "ORDINARY"]);

export type HrSettingsInput = {
  fiveDayWeeklyHours?: number | null;
  sixDayWeeklyHours?: number | null;
  medicalWeeklyHours?: number | null;
  customWeeklyHours?: number | null;
  advanceMaxPercent?: number | null;
  advanceMaxAmount?: number | null;
  advanceMaxOpen?: number | null;
  advanceAllowHrProxy?: boolean;
  advancePayDay?: number | null;
  allowEmployeeSubmit?: boolean;
  allowManagerSubmit?: boolean;
};

export type RouteStepInput = {
  kind: string;
  orgUnitId?: string | null;
  positionId?: string | null;
  appliesTo?: string | null;
  canExceedAdvanceCap?: boolean;
};

function dec(value: number | null | undefined): Prisma.Decimal | null {
  if (value == null) return null;
  if (!(value > 0)) return null;
  return new Prisma.Decimal(value);
}

@Injectable()
export class WorkforceHrSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceWorkforceMirrorClient,
    private readonly scope: WorkforceScopeService,
  ) {}

  async get(organizationId: string) {
    const [settings, routes] = await Promise.all([
      this.prisma.workforceOrgSettings.findUnique({ where: { organizationId } }),
      this.prisma.workforceApprovalRoute.findMany({
        where: { organizationId },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      }),
    ]);
    return {
      settings: settings
        ? {
            fiveDayWeeklyHours: num(settings.fiveDayWeeklyHours),
            sixDayWeeklyHours: num(settings.sixDayWeeklyHours),
            medicalWeeklyHours: num(settings.medicalWeeklyHours),
            customWeeklyHours: num(settings.customWeeklyHours),
            advanceMaxPercent: num(settings.advanceMaxPercent),
            advanceMaxAmount: num(settings.advanceMaxAmount),
            advanceMaxOpen: settings.advanceMaxOpen,
            advanceAllowHrProxy: settings.advanceAllowHrProxy,
            advancePayDay: settings.advancePayDay,
            allowEmployeeSubmit: settings.allowEmployeeSubmit,
            allowManagerSubmit: settings.allowManagerSubmit,
          }
        : emptySettings(),
      routes: routes.map((route) => ({
        kind: route.kind,
        steps: route.steps.map((step) => ({
          kind: step.kind,
          orgUnitId: step.orgUnitId,
          positionId: step.positionId,
          appliesTo: step.appliesTo,
          canExceedAdvanceCap: step.canExceedAdvanceCap,
        })),
      })),
    };
  }

  async saveSettings(organizationId: string, input: HrSettingsInput) {
    const data = {
      fiveDayWeeklyHours: dec(input.fiveDayWeeklyHours),
      sixDayWeeklyHours: dec(input.sixDayWeeklyHours),
      medicalWeeklyHours: dec(input.medicalWeeklyHours),
      customWeeklyHours: dec(input.customWeeklyHours),
      advanceMaxPercent: dec(input.advanceMaxPercent),
      advanceMaxAmount: dec(input.advanceMaxAmount),
      advanceMaxOpen:
        input.advanceMaxOpen != null && input.advanceMaxOpen > 0
          ? Math.floor(input.advanceMaxOpen)
          : null,
      advanceAllowHrProxy: input.advanceAllowHrProxy === true,
      advancePayDay:
        input.advancePayDay != null &&
        input.advancePayDay >= 1 &&
        input.advancePayDay <= 31
          ? Math.floor(input.advancePayDay)
          : null,
      allowEmployeeSubmit: input.allowEmployeeSubmit !== false,
      allowManagerSubmit: input.allowManagerSubmit === true,
    };
    await this.prisma.workforceOrgSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
    return this.get(organizationId);
  }

  async saveRoute(
    organizationId: string,
    kind: string,
    steps: RouteStepInput[],
  ) {
    if (!KINDS.has(kind)) {
      throw new BadRequestException("Unknown approval route kind");
    }
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const units = await this.prisma.orgUnit.findMany({
      where: { workforceScopeId: link.workforceScope.id },
      select: { id: true },
    });
    const unitIds = new Set(units.map((unit) => unit.id));
    const cleaned = steps.map((step, index) => {
      if (!STEP_KINDS.has(step.kind)) {
        throw new BadRequestException(`Unknown step kind at ${index}`);
      }
      const orgUnitId = step.orgUnitId?.trim() || null;
      const positionId = step.positionId?.trim() || null;
      if (step.kind !== WorkforceApprovalStepKind.REQUESTER_MANAGER && !orgUnitId) {
        throw new BadRequestException("Org unit is required for this step");
      }
      if (orgUnitId && !unitIds.has(orgUnitId)) {
        throw new BadRequestException("Org unit is outside this organization");
      }
      if (step.kind === WorkforceApprovalStepKind.POSITION_IN_UNIT && !positionId) {
        throw new BadRequestException("Position is required for this step");
      }
      const appliesTo = AUDIENCES.has(step.appliesTo ?? "")
        ? (step.appliesTo as "ALWAYS" | "LEADERSHIP" | "ORDINARY")
        : "ALWAYS";
      return {
        stepOrder: index,
        kind: step.kind as WorkforceApprovalStepKind,
        appliesTo: appliesTo as WorkforceApprovalStepAudience,
        canExceedAdvanceCap: step.canExceedAdvanceCap === true,
        orgUnitId:
          step.kind === WorkforceApprovalStepKind.REQUESTER_MANAGER ? null : orgUnitId,
        positionId:
          step.kind === WorkforceApprovalStepKind.POSITION_IN_UNIT ? positionId : null,
      };
    });
    await this.prisma.$transaction(async (tx) => {
      const route = await tx.workforceApprovalRoute.upsert({
        where: {
          organizationId_kind: {
            organizationId,
            kind: kind as WorkforceApprovalRequestKind,
          },
        },
        create: {
          organizationId,
          kind: kind as WorkforceApprovalRequestKind,
        },
        update: {},
      });
      await tx.workforceApprovalStep.deleteMany({ where: { routeId: route.id } });
      if (cleaned.length > 0) {
        await tx.workforceApprovalStep.createMany({
          data: cleaned.map((step) => ({ ...step, routeId: route.id })),
        });
      }
    });
    return this.get(organizationId);
  }

  async assertAdvanceAllowed(
    organizationId: string,
    employmentId: string,
    amountAzn: number,
  ): Promise<boolean> {
    const settings = await this.prisma.workforceOrgSettings.findUnique({
      where: { organizationId },
    });
    if (!settings) return false;
    if (
      settings.advanceMaxAmount != null &&
      amountAzn > Number(settings.advanceMaxAmount)
    ) {
      throw new BadRequestException({
        code: "ADVANCE_AMOUNT_LIMIT",
        message: "Advance amount is above the organization limit",
      });
    }
    if (settings.advanceMaxOpen != null && settings.advanceMaxOpen > 0) {
      const open = await this.prisma.workforceAdvanceRequest.count({
        where: {
          organizationId,
          employmentId,
          status: {
            in: [
              WorkforceSelfRequestStatus.SUBMITTED,
              WorkforceSelfRequestStatus.APPROVED,
            ],
          },
        },
      });
      if (open >= settings.advanceMaxOpen) {
        throw new BadRequestException({
          code: "ADVANCE_OPEN_LIMIT",
          message: "Open advance limit reached",
        });
      }
    }
    if (settings.advanceMaxPercent != null && Number(settings.advanceMaxPercent) > 0) {
      const mirror = await this.finance.fetchEmploymentMirror(
        organizationId,
        employmentId,
      );
      if (mirror.salary == null || !(mirror.salary > 0)) {
        throw new BadRequestException({
          code: "ADVANCE_SALARY_UNKNOWN",
          message: "Percent limit is set but contract salary is unknown",
        });
      }
      const cap = (mirror.salary * Number(settings.advanceMaxPercent)) / 100;
      if (amountAzn > cap) {
        const allowed = await this.routeCanExceedPercent(organizationId, employmentId);
        if (!allowed) {
          throw new BadRequestException({
            code: "ADVANCE_PERCENT_LIMIT",
            message: "Advance amount is above the salary percent limit",
          });
        }
        return true;
      }
    }
    return false;
  }

  private async routeCanExceedPercent(
    organizationId: string,
    employmentId: string,
  ): Promise<boolean> {
    const [route, employment] = await Promise.all([
      this.prisma.workforceApprovalRoute.findUnique({
        where: {
          organizationId_kind: {
            organizationId,
            kind: WorkforceApprovalRequestKind.ADVANCE,
          },
        },
        include: { steps: true },
      }),
      this.prisma.workforceEmployment.findFirst({
        where: { id: employmentId, organizationId },
        select: { position: { select: { leadership: true } } },
      }),
    ]);
    const leadership = employment?.position?.leadership === true;
    return (route?.steps ?? []).some(
      (step) => step.canExceedAdvanceCap && stepApplies(step.appliesTo, leadership),
    );
  }
}

function num(value: Prisma.Decimal | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

function emptySettings() {
  return {
    fiveDayWeeklyHours: null as number | null,
    sixDayWeeklyHours: null as number | null,
    medicalWeeklyHours: null as number | null,
    customWeeklyHours: null as number | null,
    advanceMaxPercent: null as number | null,
    advanceMaxAmount: null as number | null,
    advanceMaxOpen: null as number | null,
    advanceAllowHrProxy: false,
    advancePayDay: null as number | null,
    allowEmployeeSubmit: true,
    allowManagerSubmit: false,
  };
}
