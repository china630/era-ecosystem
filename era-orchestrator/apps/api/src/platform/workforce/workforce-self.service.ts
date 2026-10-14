import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import * as bcrypt from "bcrypt";
import {
  Prisma,
  UserRole,
  WorkforceAbsenceKind,
  WorkforceAbsenceStatus,
  WorkforceApprovalRequestKind,
  WorkforceAttendanceDirection,
  WorkforceAttendanceJournalAction,
  WorkforceEmploymentStatus,
  WorkforceSelfRequestStatus,
  WorkforceTimesheetEntryStatus,
  WorkforceTimesheetStatus,
} from "@era365/database";
import { CP_PERMISSION } from "../../auth/cp-permissions";
import { PrismaService } from "../../prisma/prisma.service";
import { MdmService } from "../../mdm/mdm.service";
import { encryptText } from "../../security/pii-crypto.util";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceAbsencesService } from "./workforce-absences.service";
import { FinanceWorkforceMirrorClient } from "./finance-workforce-mirror.client";
import { WorkforceApprovalService } from "./workforce-approval.service";
import { WorkforceHrSettingsService } from "./workforce-hr-settings.service";
import { CatalogGatewayService } from "../catalog/catalog-gateway.service";
import { nextPlannedPayDate, type CalendarDayInput } from "./workforce-calendar-norm";
import { addBakuDays, todayBakuYmd, bakuDateKey } from "@era/satellite-kit/time";

const SELF_ROLE_CODE = "WORKFORCE_SELF";
const SELF_PERMS = JSON.stringify([
  CP_PERMISSION.API_WORKFORCE_SELF,
  CP_PERMISSION.SCREEN_WORKSPACE_ME,
  CP_PERMISSION.SCREEN_WORKSPACE_HOME,
]);

function parseYmd(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class WorkforceSelfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly audit: WorkforceAuditService,
    private readonly absences: WorkforceAbsencesService,
    private readonly mdm: MdmService,
    private readonly financeMirror: FinanceWorkforceMirrorClient,
    @Optional() private readonly approval?: WorkforceApprovalService,
    @Optional() private readonly hrSettings?: WorkforceHrSettingsService,
    @Optional() private readonly catalog?: CatalogGatewayService,
  ) {}

  /** Active employments linked to this platform user (multi-VÖEN switch). */
  async listMyEmployments(userId: string) {
    const rows = await this.prisma.workforceEmployment.findMany({
      where: {
        platformUserId: userId,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
      include: {
        organization: { select: { id: true, name: true } },
        orgUnit: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
      },
      orderBy: { hireDate: "desc" },
    });
    return rows.map((r) => ({
      employmentId: r.id,
      organizationId: r.organizationId,
      organizationName: r.organization.name,
      orgUnitName: r.orgUnit.name,
      positionName: r.position.name,
      globalPersonId: r.globalPersonId,
      financeEmployeeId: r.financeEmployeeId,
    }));
  }

  async assertOwnEmployment(
    organizationId: string,
    userId: string,
    employmentId: string,
  ) {
    const emp = await this.prisma.workforceEmployment.findFirst({
      where: {
        id: employmentId,
        organizationId,
        platformUserId: userId,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
    });
    if (!emp) {
      throw new ForbiddenException("Employment is not yours");
    }
    return emp;
  }

  private async assertEmployeeSubmitAllowed(organizationId: string) {
    const settings = await this.prisma.workforceOrgSettings?.findUnique?.({
      where: { organizationId },
    });
    if (settings && settings.allowEmployeeSubmit === false) {
      throw new ForbiddenException({
        code: "EMPLOYEE_SUBMIT_DISABLED",
        message: "Employee self-submit is turned off",
      });
    }
  }

  private async assertManagerOfUnit(
    organizationId: string,
    actorUserId: string,
    orgUnitId: string,
  ) {
    const actor = await this.prisma.workforceEmployment.findFirst({
      where: {
        organizationId,
        platformUserId: actorUserId,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
      select: { id: true },
    });
    let unitId: string | null = orgUnitId;
    for (let guard = 0; unitId && guard < 24; guard += 1) {
      const currentId: string = unitId;
      const unit = await this.prisma.orgUnit.findFirst({
        where: { id: currentId },
        select: { parentId: true, managerEmploymentId: true, managerUserId: true },
      });
      if (!unit) break;
      if (unit.managerUserId === actorUserId) return;
      if (actor && unit.managerEmploymentId === actor.id) return;
      unitId = unit.parentId;
    }
    throw new ForbiddenException({
      code: "MANAGER_SUBMIT_FORBIDDEN",
      message: "Only the unit manager may file this request",
    });
  }

  private async plannedAdvancePayDate(organizationId: string): Promise<Date | null> {
    const settings = await this.prisma.workforceOrgSettings?.findUnique?.({
      where: { organizationId },
    });
    const payDay = settings?.advancePayDay;
    if (payDay == null || payDay < 1 || payDay > 31) return null;
    const today = todayBakuYmd();
    const end = addBakuDays(today, 45);
    let hubDays: CalendarDayInput[] = [];
    if (this.catalog) {
      try {
        const cal = (await this.catalog.getCalendarDaysRange(
          "AZ",
          today,
          end,
          organizationId,
        )) as { days?: CalendarDayInput[] };
        hubDays = cal.days ?? [];
      } catch {
        hubDays = [];
      }
    }
    return new Date(`${nextPlannedPayDate(today, payDay, hubDays)}T00:00:00.000Z`);
  }

  async cabinetContext(organizationId: string, userId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const employments = await this.listMyEmployments(userId);
    const current = employments.find((e) => e.organizationId === organizationId);
    if (!current) {
      throw new ForbiddenException("No active employment in this organization");
    }
    const profile = await this.mdm.getPersonOpsProfile(
      current.globalPersonId,
      organizationId,
    );
    const unread = await this.unreadAnnouncementCount(
      organizationId,
      current.employmentId,
    );
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { activeModules: true },
    });
    const hrFull = (org?.activeModules ?? []).includes("hr_full");
    return {
      employment: current,
      employments,
      profile: {
        fullName: profile.fullName,
        phoneMasked: profile.phoneMasked,
        nationality: (profile as { nationality?: string | null }).nationality ?? null,
      },
      unreadAnnouncements: unread,
      hrFull,
      payslipAvailable: hrFull && Boolean(current.financeEmployeeId),
    };
  }

  async submitFullDayAbsence(
    organizationId: string,
    userId: string,
    dto: {
      employmentId: string;
      kind: WorkforceAbsenceKind;
      startDate: string;
      endDate: string;
      note?: string;
    },
  ) {
    await this.assertOwnEmployment(organizationId, userId, dto.employmentId);
    await this.assertEmployeeSubmitAllowed(organizationId);
    return this.absences.create(organizationId, userId, {
      employmentId: dto.employmentId,
      kind: dto.kind,
      startDate: dto.startDate,
      endDate: dto.endDate,
      note: dto.note,
      submit: true,
    });
  }

  async submitHourlyLeave(
    organizationId: string,
    userId: string,
    dto: {
      employmentId: string;
      workDate: string;
      startMinute: number;
      endMinute: number;
      paid: boolean;
      note?: string;
    },
  ) {
    await this.assertOwnEmployment(organizationId, userId, dto.employmentId);
    await this.assertEmployeeSubmitAllowed(organizationId);
    if (
      !Number.isInteger(dto.startMinute) ||
      !Number.isInteger(dto.endMinute) ||
      dto.startMinute < 0 ||
      dto.endMinute > 1440 ||
      dto.endMinute <= dto.startMinute
    ) {
      throw new BadRequestException("Invalid startMinute/endMinute");
    }
    const row = await this.prisma.workforceHourlyLeaveRequest.create({
      data: {
        organizationId,
        employmentId: dto.employmentId,
        workDate: parseYmd(dto.workDate),
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        paid: dto.paid === true,
        note: (dto.note ?? "").trim(),
        status: WorkforceSelfRequestStatus.SUBMITTED,
        submittedByUserId: userId,
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId: userId,
      action: "HOURLY_LEAVE_SUBMITTED",
      entityType: "HOURLY_LEAVE",
      entityId: row.id,
      payload: { workDate: dto.workDate, paid: row.paid },
    });
    return row;
  }

  async submitLateNote(
    organizationId: string,
    userId: string,
    dto: { employmentId: string; punchId: string; reason: string },
  ) {
    await this.assertOwnEmployment(organizationId, userId, dto.employmentId);
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException("reason required");
    }
    const today = todayBakuYmd();
    const punch = await this.prisma.workforceAttendancePunch.findFirst({
      where: {
        id: dto.punchId,
        organizationId,
        employmentId: dto.employmentId,
        direction: WorkforceAttendanceDirection.IN,
      },
    });
    if (!punch) throw new NotFoundException("Punch not found");
    const punchYmd = bakuDateKey(punch.occurredAt);
    if (punchYmd !== today) {
      throw new BadRequestException("Late note allowed only for today's IN punch");
    }
    const journal = await this.prisma.workforceAttendancePunchJournal.create({
      data: {
        organizationId,
        punchId: punch.id,
        actorUserId: userId,
        action: WorkforceAttendanceJournalAction.NOTE,
        reason,
        beforeJson: { reviewStatus: punch.reviewStatus },
        afterJson: { lateNote: true },
      },
    });
    return journal;
  }

  async submitAdvance(
    organizationId: string,
    userId: string,
    dto: { employmentId: string; amountAzn: number; note?: string },
  ) {
    await this.assertOwnEmployment(organizationId, userId, dto.employmentId);
    await this.assertEmployeeSubmitAllowed(organizationId);
    if (!(dto.amountAzn > 0)) {
      throw new BadRequestException("amountAzn must be positive");
    }
    const exceedsLimit = this.hrSettings
      ? await this.hrSettings.assertAdvanceAllowed(
          organizationId,
          dto.employmentId,
          dto.amountAzn,
        )
      : false;
    const row = await this.prisma.workforceAdvanceRequest.create({
      data: {
        organizationId,
        employmentId: dto.employmentId,
        amountAzn: new Prisma.Decimal(dto.amountAzn),
        note: (dto.note ?? "").trim(),
        status: WorkforceSelfRequestStatus.SUBMITTED,
        submittedByUserId: userId,
        exceedsLimit,
        plannedPayDate: await this.plannedAdvancePayDate(organizationId),
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId: userId,
      action: "ADVANCE_SUBMITTED",
      entityType: "ADVANCE_REQUEST",
      entityId: row.id,
      payload: { amountAzn: dto.amountAzn },
    });
    return row;
  }

  /** HR files an advance for an employee who has no cabinet login. */
  async submitAdvanceByHr(
    organizationId: string,
    actorUserId: string,
    dto: { employmentId: string; amountAzn: number; note?: string },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const settings = await this.prisma.workforceOrgSettings.findUnique({
      where: { organizationId },
    });
    if (!settings?.advanceAllowHrProxy) {
      throw new ForbiddenException({
        code: "ADVANCE_PROXY_DISABLED",
        message: "HR proxy advance is turned off for this organization",
      });
    }
    if (!(dto.amountAzn > 0)) {
      throw new BadRequestException("amountAzn must be positive");
    }
    const employment = await this.prisma.workforceEmployment.findFirst({
      where: {
        id: dto.employmentId,
        organizationId,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
    });
    if (!employment) throw new NotFoundException("Active employment required");
    const exceedsLimit = this.hrSettings
      ? await this.hrSettings.assertAdvanceAllowed(
          organizationId,
          dto.employmentId,
          dto.amountAzn,
        )
      : false;
    const row = await this.prisma.workforceAdvanceRequest.create({
      data: {
        organizationId,
        employmentId: dto.employmentId,
        amountAzn: new Prisma.Decimal(dto.amountAzn),
        note: (dto.note ?? "").trim(),
        status: WorkforceSelfRequestStatus.SUBMITTED,
        submittedByUserId: actorUserId,
        exceedsLimit,
        plannedPayDate: await this.plannedAdvancePayDate(organizationId),
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ADVANCE_SUBMITTED",
      entityType: "ADVANCE_REQUEST",
      entityId: row.id,
      payload: { amountAzn: dto.amountAzn, proxy: true },
    });
    return row;
  }

  /** Unit manager files a request for someone in their unit. HR screens stay separate. */
  async submitOnBehalf(
    organizationId: string,
    actorUserId: string,
    dto: {
      kind: "FULL_DAY" | "HOURLY" | "ADVANCE";
      employmentId: string;
      absenceKind?: WorkforceAbsenceKind;
      startDate?: string;
      endDate?: string;
      workDate?: string;
      startMinute?: number;
      endMinute?: number;
      paid?: boolean;
      amountAzn?: number;
      note?: string;
    },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const settings = await this.prisma.workforceOrgSettings.findUnique({
      where: { organizationId },
    });
    if (!settings?.allowManagerSubmit) {
      throw new ForbiddenException({
        code: "MANAGER_SUBMIT_DISABLED",
        message: "Manager submit is turned off for this organization",
      });
    }
    const employment = await this.prisma.workforceEmployment.findFirst({
      where: {
        id: dto.employmentId,
        organizationId,
        status: WorkforceEmploymentStatus.ACTIVE,
      },
    });
    if (!employment) throw new NotFoundException("Active employment required");
    await this.assertManagerOfUnit(organizationId, actorUserId, employment.orgUnitId);
    if (dto.kind === "ADVANCE") {
      if (!(dto.amountAzn && dto.amountAzn > 0)) {
        throw new BadRequestException("amountAzn must be positive");
      }
      const exceedsLimit = this.hrSettings
        ? await this.hrSettings.assertAdvanceAllowed(
            organizationId,
            dto.employmentId,
            dto.amountAzn,
          )
        : false;
      const row = await this.prisma.workforceAdvanceRequest.create({
        data: {
          organizationId,
          employmentId: dto.employmentId,
          amountAzn: new Prisma.Decimal(dto.amountAzn),
          note: (dto.note ?? "").trim(),
          status: WorkforceSelfRequestStatus.SUBMITTED,
          submittedByUserId: actorUserId,
          exceedsLimit,
          plannedPayDate: await this.plannedAdvancePayDate(organizationId),
        },
      });
      await this.audit.log({
        organizationId,
        actorUserId,
        action: "ADVANCE_SUBMITTED",
        entityType: "ADVANCE_REQUEST",
        entityId: row.id,
        payload: { amountAzn: dto.amountAzn, manager: true },
      });
      return row;
    }
    if (dto.kind === "HOURLY") {
      if (
        !dto.workDate ||
        dto.startMinute == null ||
        dto.endMinute == null ||
        dto.endMinute <= dto.startMinute
      ) {
        throw new BadRequestException("Invalid hourly leave");
      }
      const row = await this.prisma.workforceHourlyLeaveRequest.create({
        data: {
          organizationId,
          employmentId: dto.employmentId,
          workDate: parseYmd(dto.workDate),
          startMinute: dto.startMinute ?? 0,
          endMinute: dto.endMinute ?? 0,
          paid: dto.paid === true,
          note: (dto.note ?? "").trim(),
          status: WorkforceSelfRequestStatus.SUBMITTED,
          submittedByUserId: actorUserId,
        },
      });
      await this.audit.log({
        organizationId,
        actorUserId,
        action: "HOURLY_LEAVE_SUBMITTED",
        entityType: "HOURLY_LEAVE",
        entityId: row.id,
        payload: { manager: true, workDate: dto.workDate },
      });
      return row;
    }
    if (!dto.startDate || !dto.endDate || !dto.absenceKind) {
      throw new BadRequestException("startDate, endDate and absenceKind required");
    }
    return this.absences.create(organizationId, actorUserId, {
      employmentId: dto.employmentId,
      kind: dto.absenceKind,
      startDate: dto.startDate,
      endDate: dto.endDate,
      note: dto.note,
      submit: true,
    });
  }

  async labelSubmitters(organizationId: string, userIds: string[]) {
    const ids = [...new Set(userIds.filter(Boolean))];
    const out: Record<string, { label: string; hr: boolean }> = {};
    if (ids.length === 0) return out;
    const emps = await this.prisma.workforceEmployment.findMany({
      where: {
        organizationId,
        platformUserId: { in: ids },
        status: WorkforceEmploymentStatus.ACTIVE,
      },
      select: { platformUserId: true, globalPersonId: true },
    });
    const profiles = await this.mdm.batchGetPersonOpsProfile(
      emps.map((row) => row.globalPersonId),
      organizationId,
    );
    for (const id of ids) {
      const emp = emps.find((row) => row.platformUserId === id);
      const profile = emp ? profiles[emp.globalPersonId] : null;
      const saa = [profile?.lastName, profile?.firstName, profile?.middleName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean)
        .join(" ");
      const label = saa || String(profile?.displayName ?? "").trim();
      out[id] = { label, hr: !emp };
    }
    return out;
  }

  async listAnnouncements(organizationId: string, userId: string, employmentId: string) {
    await this.assertOwnEmployment(organizationId, userId, employmentId);
    const rows = await this.prisma.workforceAnnouncement.findMany({
      where: { organizationId },
      orderBy: { publishedAt: "desc" },
      take: 50,
      include: {
        reads: { where: { employmentId }, take: 1 },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      publishedAt: r.publishedAt.toISOString(),
      read: r.reads.length > 0,
    }));
  }

  async markAnnouncementRead(
    organizationId: string,
    userId: string,
    employmentId: string,
    announcementId: string,
  ) {
    await this.assertOwnEmployment(organizationId, userId, employmentId);
    const ann = await this.prisma.workforceAnnouncement.findFirst({
      where: { id: announcementId, organizationId },
    });
    if (!ann) throw new NotFoundException("Announcement not found");
    await this.prisma.workforceAnnouncementRead.upsert({
      where: {
        announcementId_employmentId: { announcementId, employmentId },
      },
      create: {
        organizationId,
        announcementId,
        employmentId,
      },
      update: { readAt: new Date() },
    });
    return { ok: true };
  }

  private async unreadAnnouncementCount(
    organizationId: string,
    employmentId: string,
  ) {
    const total = await this.prisma.workforceAnnouncement.count({
      where: { organizationId },
    });
    const read = await this.prisma.workforceAnnouncementRead.count({
      where: { organizationId, employmentId },
    });
    return Math.max(0, total - read);
  }

  async getOwnPayslip(
    organizationId: string,
    userId: string,
    employmentId: string,
    year: number,
    month: number,
  ) {
    const emp = await this.assertOwnEmployment(
      organizationId,
      userId,
      employmentId,
    );
    if (!emp.financeEmployeeId) {
      throw new NotFoundException("Payslip not available");
    }
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { activeModules: true },
    });
    if (!(org?.activeModules ?? []).includes("hr_full")) {
      throw new NotFoundException("Payslip not available");
    }
    const slip = await this.financeMirror.fetchPostedPayslip({
      organizationId,
      financeEmployeeId: emp.financeEmployeeId,
      year,
      month,
    });
    if (!slip) throw new NotFoundException("Payslip not available");
    const { internalRate: _drop, ...safe } = slip as typeof slip & {
      internalRate?: unknown;
    };
    return safe;
  }

  // --- HR ---

  async enableCabinet(
    organizationId: string,
    actorUserId: string,
    employmentId: string,
    dto: { loginEmail?: string; temporaryPassword?: string },
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const emp = await this.prisma.workforceEmployment.findFirst({
      where: { id: employmentId, organizationId },
    });
    if (!emp) throw new NotFoundException("Employment not found");
    if (emp.status !== WorkforceEmploymentStatus.ACTIVE) {
      throw new BadRequestException("Employment must be ACTIVE");
    }

    let userId = emp.platformUserId;
    let temporaryPassword: string | null = null;
    let createdUser = false;

    if (!userId) {
      const email = (dto.loginEmail ?? "").toLowerCase().trim();
      if (!email || !email.includes("@")) {
        throw new BadRequestException(
          "loginEmail required to create or link the cabinet user",
        );
      }
      temporaryPassword =
        dto.temporaryPassword?.trim() ||
        `Era${randomBytes(4).toString("hex")}!`;
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) {
        userId = existing.id;
      } else {
        const ops = await this.mdm.getPersonOpsProfile(
          emp.globalPersonId,
          organizationId,
        );
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);
        const created = await this.prisma.user.create({
          data: {
            email,
            passwordHash,
            firstNameCipher: encryptText(
              ops.firstName?.trim() || "Employee",
            ),
            lastNameCipher: encryptText(ops.lastName?.trim() || "Cabinet"),
          },
        });
        userId = created.id;
        createdUser = true;
      }

      const role = await this.ensureSelfRole(organizationId);
      const membership = await this.prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: { userId, organizationId },
        },
      });
      if (!membership) {
        await this.prisma.organizationMembership.create({
          data: {
            userId,
            organizationId,
            role: UserRole.USER,
            organizationRoleId: role.id,
          },
        });
      } else if (membership.deletedAt) {
        await this.prisma.organizationMembership.update({
          where: {
            userId_organizationId: { userId, organizationId },
          },
          data: {
            deletedAt: null,
            role: UserRole.USER,
            organizationRoleId: role.id,
          },
        });
      } else if (!membership.organizationRoleId) {
        await this.prisma.organizationMembership.update({
          where: {
            userId_organizationId: { userId, organizationId },
          },
          data: { organizationRoleId: role.id },
        });
      }

      await this.prisma.workforceEmployment.update({
        where: { id: emp.id },
        data: { platformUserId: userId },
      });
    }

    await this.audit.log({
      organizationId,
      actorUserId,
      action: "CABINET_ENABLED",
      entityType: "EMPLOYMENT",
      entityId: employmentId,
      payload: { platformUserId: userId, createdUser },
    });

    return {
      employmentId,
      platformUserId: userId,
      createdUser,
      temporaryPassword: createdUser ? temporaryPassword : null,
    };
  }

  private async ensureSelfRole(organizationId: string) {
    const existing = await this.prisma.organizationRole.findFirst({
      where: { organizationId, code: SELF_ROLE_CODE },
    });
    if (existing) {
      if (existing.permissionsJson !== SELF_PERMS) {
        return this.prisma.organizationRole.update({
          where: { id: existing.id },
          data: { permissionsJson: SELF_PERMS },
        });
      }
      return existing;
    }
    return this.prisma.organizationRole.create({
      data: {
        organizationId,
        code: SELF_ROLE_CODE,
        name: "Workforce self (phone)",
        isSystem: false,
        permissionsJson: SELF_PERMS,
        permissionCatalogVersion: 1,
      },
    });
  }

  async publishAnnouncement(
    organizationId: string,
    actorUserId: string,
    body: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const text = body.trim();
    if (text.length < 1) throw new BadRequestException("body required");
    return this.prisma.workforceAnnouncement.create({
      data: {
        organizationId,
        body: text,
        publishedByUserId: actorUserId,
      },
    });
  }

  async listPendingRequests(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const [absences, hourly, advances] = await Promise.all([
      this.prisma.workforceAbsence.findMany({
        where: {
          organizationId,
          status: WorkforceAbsenceStatus.SUBMITTED,
        },
        include: {
          employment: {
            select: {
              id: true,
              globalPersonId: true,
              orgUnit: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
        },
        orderBy: { submittedAt: "asc" },
      }),
      this.prisma.workforceHourlyLeaveRequest.findMany({
        where: {
          organizationId,
          status: WorkforceSelfRequestStatus.SUBMITTED,
        },
        include: {
          employment: {
            select: {
              id: true,
              globalPersonId: true,
              orgUnit: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
        },
        orderBy: { submittedAt: "asc" },
      }),
      this.prisma.workforceAdvanceRequest.findMany({
        where: {
          organizationId,
          status: WorkforceSelfRequestStatus.SUBMITTED,
        },
        include: {
          employment: {
            select: {
              id: true,
              globalPersonId: true,
              orgUnit: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
        },
        orderBy: { submittedAt: "asc" },
      }),
    ]);
    return { absences, hourly, advances };
  }

  async approveHourlyLeave(
    organizationId: string,
    actorUserId: string,
    id: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const row = await this.prisma.workforceHourlyLeaveRequest.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Hourly leave not found");
    if (row.status !== WorkforceSelfRequestStatus.SUBMITTED) {
      throw new BadRequestException("Request is not SUBMITTED");
    }
    if (this.approval) {
      const gate = await this.approval.gate({
        organizationId,
        kind: WorkforceApprovalRequestKind.HOURLY,
        employmentId: row.employmentId,
        stepOrder: row.currentStepOrder ?? 0,
        actorUserId,
        entityType: "HOURLY",
        entityId: id,
      });
      if (gate.action === "advance") {
        await this.prisma.workforceHourlyLeaveRequest.update({
          where: { id },
          data: { currentStepOrder: gate.nextStep },
        });
        return { ok: true, advanced: true };
      }
    }
    const minutes = row.endMinute - row.startMinute;
    const y = row.workDate.getUTCFullYear();
    const m = row.workDate.getUTCMonth() + 1;

    await this.prisma.$transaction(async (tx) => {
      let ts = await tx.workforceTimesheet.findUnique({
        where: {
          organizationId_year_month: { organizationId, year: y, month: m },
        },
      });
      if (!ts) {
        ts = await tx.workforceTimesheet.create({
          data: {
            organizationId,
            year: y,
            month: m,
            status: WorkforceTimesheetStatus.DRAFT,
          },
        });
      }
      if (ts.status !== WorkforceTimesheetStatus.DRAFT) {
        throw new BadRequestException("Month timesheet is not DRAFT");
      }
      const existing = await tx.workforceTimesheetEntry.findUnique({
        where: {
          timesheetId_employmentId_workDate: {
            timesheetId: ts.id,
            employmentId: row.employmentId,
            workDate: row.workDate,
          },
        },
      });
      if (
        existing &&
        (existing.status === WorkforceTimesheetEntryStatus.APPROVED ||
          existing.lockedFromAbsence)
      ) {
        throw new BadRequestException(
          "Cannot write hourly leave onto APPROVED or absence-locked cell",
        );
      }
      if (
        existing &&
        (existing.hourlyLeaveMinutes ?? 0) > 0 &&
        existing.hourlyLeavePaid !== row.paid
      ) {
        throw new BadRequestException(
          "Paid and unpaid hourly leave cannot share one day",
        );
      }
      const prev = existing?.hourlyLeaveMinutes ?? 0;
      await tx.workforceTimesheetEntry.upsert({
        where: {
          timesheetId_employmentId_workDate: {
            timesheetId: ts.id,
            employmentId: row.employmentId,
            workDate: row.workDate,
          },
        },
        create: {
          organizationId,
          timesheetId: ts.id,
          employmentId: row.employmentId,
          workDate: row.workDate,
          hours: new Prisma.Decimal(0),
          type: "WORK",
          source: "hourly_leave",
          status: WorkforceTimesheetEntryStatus.DRAFT,
          hourlyLeaveMinutes: minutes,
          hourlyLeavePaid: row.paid,
        },
        update: {
          hourlyLeaveMinutes: prev + minutes,
          hourlyLeavePaid: row.paid || existing?.hourlyLeavePaid === true,
        },
      });
      await tx.workforceHourlyLeaveRequest.update({
        where: { id: row.id },
        data: {
          status: WorkforceSelfRequestStatus.APPROVED,
          decidedAt: new Date(),
          decidedByUserId: actorUserId,
        },
      });
    });

    await this.audit.log({
      organizationId,
      actorUserId,
      action: "HOURLY_LEAVE_APPROVED",
      entityType: "HOURLY_LEAVE",
      entityId: id,
      payload: { minutes, paid: row.paid },
    });
    return { ok: true };
  }

  async rejectHourlyLeave(
    organizationId: string,
    actorUserId: string,
    id: string,
    reason?: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const row = await this.prisma.workforceHourlyLeaveRequest.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Hourly leave not found");
    if (row.status !== WorkforceSelfRequestStatus.SUBMITTED) {
      throw new BadRequestException("Request is not SUBMITTED");
    }
    if (this.approval) {
      await this.approval.rejectStep({
        organizationId,
        kind: WorkforceApprovalRequestKind.HOURLY,
        employmentId: row.employmentId,
        stepOrder: row.currentStepOrder ?? 0,
        actorUserId,
        entityType: "HOURLY",
        entityId: id,
        reason,
      });
    }
    return this.prisma.workforceHourlyLeaveRequest.update({
      where: { id },
      data: {
        status: WorkforceSelfRequestStatus.REJECTED,
        decidedAt: new Date(),
        decidedByUserId: actorUserId,
        rejectionReason: (reason ?? "").trim() || null,
      },
    });
  }

  async approveAdvance(
    organizationId: string,
    actorUserId: string,
    id: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const row = await this.prisma.workforceAdvanceRequest.findFirst({
      where: { id, organizationId },
      include: { employment: true },
    });
    if (!row) throw new NotFoundException("Advance request not found");
    if (row.status !== WorkforceSelfRequestStatus.SUBMITTED) {
      throw new BadRequestException("Request is not SUBMITTED");
    }
    let approvedStep: number | null = row.currentStepOrder ?? 0;
    if (this.approval) {
      const gate = await this.approval.gate({
        organizationId,
        kind: WorkforceApprovalRequestKind.ADVANCE,
        employmentId: row.employmentId,
        stepOrder: row.currentStepOrder ?? 0,
        actorUserId,
        entityType: "ADVANCE",
        entityId: id,
      });
      if (gate.action === "advance") {
        return this.prisma.workforceAdvanceRequest.update({
          where: { id },
          data: { currentStepOrder: gate.nextStep },
        });
      }
      approvedStep = gate.stepOrder;
    }
    if (row.exceedsLimit) {
      if (!this.approval || approvedStep == null) {
        throw new BadRequestException({
          code: "ADVANCE_OVER_LIMIT_STEP",
          message: "This advance is over the percent cap and needs the exception step",
        });
      }
      await this.approval.assertExceedStepReached({
        organizationId,
        employmentId: row.employmentId,
        stepOrder: approvedStep,
      });
    }
    const plannedPayDate = await this.plannedAdvancePayDate(organizationId);

    let financeQueuedAt: Date | null = null;
    if (row.employment.financeEmployeeId) {
      const ymd = todayBakuYmd();
      const [year, month] = ymd.split("-").map((n) => Number(n));
      const queued = await this.financeMirror.queueAdvanceLine({
        organizationId,
        financeEmployeeId: row.employment.financeEmployeeId,
        amountAzn: Number(row.amountAzn),
        note: row.note || `CP advance ${row.id}`,
        year,
        month,
      });
      if (queued) financeQueuedAt = new Date();
    }

    const updated = await this.prisma.workforceAdvanceRequest.update({
      where: { id },
      data: {
        status: WorkforceSelfRequestStatus.APPROVED,
        decidedAt: new Date(),
        decidedByUserId: actorUserId,
        financeQueuedAt,
        plannedPayDate,
      },
    });
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "ADVANCE_APPROVED",
      entityType: "ADVANCE_REQUEST",
      entityId: id,
      payload: {
        amountAzn: Number(row.amountAzn),
        financeQueued: Boolean(financeQueuedAt),
      },
    });
    return updated;
  }

  async rejectAdvance(
    organizationId: string,
    actorUserId: string,
    id: string,
    reason?: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const row = await this.prisma.workforceAdvanceRequest.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Advance request not found");
    if (row.status !== WorkforceSelfRequestStatus.SUBMITTED) {
      throw new BadRequestException("Request is not SUBMITTED");
    }
    if (this.approval) {
      await this.approval.rejectStep({
        organizationId,
        kind: WorkforceApprovalRequestKind.ADVANCE,
        employmentId: row.employmentId,
        stepOrder: row.currentStepOrder ?? 0,
        actorUserId,
        entityType: "ADVANCE",
        entityId: id,
        reason,
      });
    }
    return this.prisma.workforceAdvanceRequest.update({
      where: { id },
      data: {
        status: WorkforceSelfRequestStatus.REJECTED,
        decidedAt: new Date(),
        decidedByUserId: actorUserId,
        rejectionReason: (reason ?? "").trim() || null,
      },
    });
  }

  /** Pending self-request employment ids for floor board (wave 12). */
  async pendingRequestEmploymentIds(organizationId: string): Promise<string[]> {
    const [abs, hourly, adv] = await Promise.all([
      this.prisma.workforceAbsence.findMany({
        where: {
          organizationId,
          status: WorkforceAbsenceStatus.SUBMITTED,
        },
        select: { employmentId: true },
      }),
      this.prisma.workforceHourlyLeaveRequest.findMany({
        where: {
          organizationId,
          status: WorkforceSelfRequestStatus.SUBMITTED,
        },
        select: { employmentId: true },
      }),
      this.prisma.workforceAdvanceRequest.findMany({
        where: {
          organizationId,
          status: WorkforceSelfRequestStatus.SUBMITTED,
        },
        select: { employmentId: true },
      }),
    ]);
    return [
      ...new Set([
        ...abs.map((r) => r.employmentId),
        ...hourly.map((r) => r.employmentId),
        ...adv.map((r) => r.employmentId),
      ]),
    ];
  }
}
