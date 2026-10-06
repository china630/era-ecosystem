import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";
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
    return { ...queue, persons };
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
