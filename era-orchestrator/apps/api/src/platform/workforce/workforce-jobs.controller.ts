import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrgUnitStatus } from "@era365/database";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { WorkforceJobsService } from "./workforce-jobs.service";

class GradeBody {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsInt()
  level!: number;
}

class GradePatchBody {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsInt()
  level?: number;
}

class JobBody {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobFamily?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  gradeId?: string | null;
}

class JobPatchBody {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(50)
  code?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(100)
  jobFamily?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  gradeId?: string | null;
}

@ApiTags("platform-workforce-jobs")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce")
@UseGuards(PermissionsGuard)
export class WorkforceJobsController {
  constructor(private readonly jobs: WorkforceJobsService) {}

  @Get("grades")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "List workforce grades" })
  listGrades(
    @OrganizationId() organizationId: string,
    @Query("status") statusRaw?: string,
  ) {
    const status =
      statusRaw === "ACTIVE" || statusRaw === "ARCHIVED"
        ? (statusRaw as OrgUnitStatus)
        : undefined;
    return this.jobs.listGrades(organizationId, status);
  }

  @Post("grades")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_POSITIONS)
  createGrade(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() body: GradeBody,
  ) {
    return this.jobs.createGrade(organizationId, user.sub, body);
  }

  @Patch("grades/:id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_POSITIONS)
  updateGrade(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() body: GradePatchBody,
  ) {
    return this.jobs.updateGrade(organizationId, id, user.sub, body);
  }

  @Post("grades/:id/archive")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_POSITIONS)
  archiveGrade(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.jobs.archiveGrade(organizationId, id, user.sub);
  }

  @Get("jobs")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  listJobs(
    @OrganizationId() organizationId: string,
    @Query("status") statusRaw?: string,
  ) {
    const status =
      statusRaw === "ACTIVE" || statusRaw === "ARCHIVED"
        ? (statusRaw as OrgUnitStatus)
        : undefined;
    return this.jobs.listJobs(organizationId, status);
  }

  @Post("jobs")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_POSITIONS)
  createJob(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() body: JobBody,
  ) {
    return this.jobs.createJob(organizationId, user.sub, body);
  }

  @Patch("jobs/:id")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_POSITIONS)
  updateJob(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() body: JobPatchBody,
  ) {
    return this.jobs.updateJob(organizationId, id, user.sub, body);
  }

  @Post("jobs/:id/archive")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_POSITIONS)
  archiveJob(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
  ) {
    return this.jobs.archiveJob(organizationId, id, user.sub);
  }

  @Get("org-chart")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Org chart nodes by mode" })
  orgChart(
    @OrganizationId() organizationId: string,
    @Query("mode") modeRaw?: string,
  ) {
    const mode =
      modeRaw === "positions" || modeRaw === "people" ? modeRaw : "units";
    return this.jobs.orgChart(organizationId, mode);
  }
}
