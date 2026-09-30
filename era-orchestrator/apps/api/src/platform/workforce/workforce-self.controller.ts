import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { WorkforceAbsenceKind } from "@era365/database";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { WorkforceSelfService } from "./workforce-self.service";

class SelfAbsenceDto {
  @IsUUID()
  employmentId!: string;

  @IsEnum(WorkforceAbsenceKind)
  kind!: WorkforceAbsenceKind;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class SelfHourlyDto {
  @IsUUID()
  employmentId!: string;

  @IsString()
  workDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute!: number;

  @IsBoolean()
  paid!: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

class SelfLateNoteDto {
  @IsUUID()
  employmentId!: string;

  @IsUUID()
  punchId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}

class SelfAdvanceDto {
  @IsUUID()
  employmentId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amountAzn!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

@ApiTags("platform-workforce-self")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/me")
@UseGuards(PermissionsGuard)
export class WorkforceSelfController {
  constructor(private readonly self: WorkforceSelfService) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SELF)
  @ApiOperation({ summary: "Employee cabinet context (own employment)" })
  context(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.self.cabinetContext(organizationId, user.sub);
  }

  @Get("employments")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SELF)
  @ApiOperation({ summary: "Own employments across orgs (two-VÖEN switch)" })
  employments(@CurrentUser() user: EraJwtPayload) {
    return this.self.listMyEmployments(user.sub);
  }

  @Post("absence")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SELF)
  submitAbsence(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: SelfAbsenceDto,
  ) {
    return this.self.submitFullDayAbsence(organizationId, user.sub, dto);
  }

  @Post("hourly-leave")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SELF)
  submitHourly(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: SelfHourlyDto,
  ) {
    return this.self.submitHourlyLeave(organizationId, user.sub, dto);
  }

  @Post("late-note")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SELF)
  lateNote(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: SelfLateNoteDto,
  ) {
    return this.self.submitLateNote(organizationId, user.sub, dto);
  }

  @Post("advance")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SELF)
  advance(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: SelfAdvanceDto,
  ) {
    return this.self.submitAdvance(organizationId, user.sub, dto);
  }

  @Get("announcements")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SELF)
  announcements(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query("employmentId") employmentId: string,
  ) {
    return this.self.listAnnouncements(organizationId, user.sub, employmentId);
  }

  @Post("announcements/:id/read")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SELF)
  markRead(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("id") id: string,
    @Body() body: { employmentId: string },
  ) {
    return this.self.markAnnouncementRead(
      organizationId,
      user.sub,
      body.employmentId,
      id,
    );
  }

  @Get("payslip")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_SELF)
  payslip(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query("employmentId") employmentId: string,
    @Query("year") year: string,
    @Query("month") month: string,
  ) {
    return this.self.getOwnPayslip(
      organizationId,
      user.sub,
      employmentId,
      Number(year),
      Number(month),
    );
  }
}
