import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from "class-validator";
import { WorkforceAbsenceKind } from "@era365/database";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";
import { RequireWorkforceFeature, WorkforcePackageGuard } from "./workforce-package.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { WorkforceSelfService } from "./workforce-self.service";
import { WorkforceAbsencesService } from "./workforce-absences.service";
import { WorkforceEmploymentsService } from "./workforce-employments.service";
import { WorkforceApprovalService } from "./workforce-approval.service";
import { WorkforceApprovalRequestKind } from "@era365/database";

class EnableCabinetDto {
  @IsOptional()
  @IsString()
  loginEmail?: string;

  @IsOptional()
  @IsString()
  temporaryPassword?: string;
}

class RejectDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class HrProxyAdvanceDto {
  @IsUUID()
  employmentId!: string;

  @IsNumber()
  amountAzn!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

class OnBehalfDto {
  @IsIn(["FULL_DAY", "HOURLY", "ADVANCE"])
  kind!: "FULL_DAY" | "HOURLY" | "ADVANCE";

  @IsUUID()
  employmentId!: string;

  @IsOptional()
  @IsEnum(WorkforceAbsenceKind)
  absenceKind?: WorkforceAbsenceKind;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  workDate?: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  startMinute?: number;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  endMinute?: number;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  amountAzn?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

class AnnounceDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

@ApiTags("platform-workforce-requests")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce")
@RequireWorkforceFeature("cabinet")
@UseGuards(PermissionsGuard, WorkforcePackageGuard)
export class WorkforceRequestsController {
  constructor(
    private readonly self: WorkforceSelfService,
    private readonly absences: WorkforceAbsencesService,
    private readonly employments: WorkforceEmploymentsService,
    private readonly approval: WorkforceApprovalService,
  ) {}

  @Get("requests")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "HR queue: submitted absences, hourly leave, advances" })
  async list(@OrganizationId() organizationId: string) {
    const queue = await this.self.listPendingRequests(organizationId);
    const personIds = [
      ...queue.absences.map((a) => a.employment.globalPersonId),
      ...queue.hourly.map((a) => a.employment.globalPersonId),
      ...queue.advances.map((a) => a.employment.globalPersonId),
    ];
    const persons = await this.employments.resolvePersonProfiles(
      organizationId,
      personIds,
    );
    const approval: Record<string, Awaited<ReturnType<WorkforceApprovalService["labelFor"]>>> = {};
    for (const row of queue.absences) {
      approval[row.id] = await this.approval.labelFor(
        organizationId,
        this.approval.kindForAbsence(row.kind),
        row.employmentId,
        row.currentStepOrder ?? 0,
      );
    }
    for (const row of queue.hourly) {
      approval[row.id] = await this.approval.labelFor(
        organizationId,
        WorkforceApprovalRequestKind.HOURLY,
        row.employmentId,
        row.currentStepOrder ?? 0,
      );
    }
    for (const row of queue.advances) {
      approval[row.id] = await this.approval.labelFor(
        organizationId,
        WorkforceApprovalRequestKind.ADVANCE,
        row.employmentId,
        row.currentStepOrder ?? 0,
      );
    }
    const history = await this.approval.recent(organizationId);
    const submitters = await this.self.labelSubmitters(
      organizationId,
      [
        ...queue.absences.map((row) => row.submittedByUserId),
        ...queue.hourly.map((row) => row.submittedByUserId),
        ...queue.advances.map((row) => row.submittedByUserId),
      ].filter((id): id is string => Boolean(id)),
    );
    return { ...queue, persons, approval, history, submitters };
  }

  @Post("requests/on-behalf")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Unit manager files a request for an employee in their unit" })
  onBehalf(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: OnBehalfDto,
  ) {
    return this.self.submitOnBehalf(organizationId, user.sub, dto);
  }

  @Post("requests/advance")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  @ApiOperation({ summary: "HR proxy advance when the organization allows it" })
  proxyAdvance(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: HrProxyAdvanceDto,
  ) {
    return this.self.submitAdvanceByHr(organizationId, user.sub, dto);
  }

  @Post("requests/hourly/:id/approve")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  approveHourly(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
  ) {
    return this.self.approveHourlyLeave(organizationId, user.sub, id);
  }

  @Post("requests/hourly/:id/reject")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  rejectHourly(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
    @Body() dto: RejectDto,
  ) {
    return this.self.rejectHourlyLeave(organizationId, user.sub, id, dto.reason);
  }

  @Post("requests/advance/:id/approve")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  approveAdvance(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
  ) {
    return this.self.approveAdvance(organizationId, user.sub, id);
  }

  @Post("requests/advance/:id/reject")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  rejectAdvance(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
    @Body() dto: RejectDto,
  ) {
    return this.self.rejectAdvance(organizationId, user.sub, id, dto.reason);
  }

  @Post("announcements")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  announce(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: AnnounceDto,
  ) {
    return this.self.publishAnnouncement(organizationId, user.sub, dto.body);
  }

  @Post("employments/:id/enable-cabinet")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_HIRE)
  @ApiOperation({ summary: "Enable employee phone cabinet (create/link platform user)" })
  enableCabinet(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
    @Body() dto: EnableCabinetDto,
  ) {
    return this.self.enableCabinet(organizationId, user.sub, id, dto);
  }

  /** Full-day absence approve stays on absences controller — re-export helper for queue UX. */
  @Post("requests/absence/:id/approve")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  approveAbsence(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
  ) {
    return this.absences.approve(organizationId, id, user.sub);
  }

  @Post("requests/absence/:id/reject")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  rejectAbsence(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
    @Body() dto: RejectDto,
  ) {
    return this.absences.reject(organizationId, id, user.sub, {
      rejectionReason: dto.reason ?? "",
    });
  }
}
