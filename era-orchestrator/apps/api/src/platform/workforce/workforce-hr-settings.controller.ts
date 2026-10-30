import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";
import { OrganizationId } from "../../common/org-id.decorator";
import {
  RequireWorkforceFeature,
  WorkforcePackageGuard,
} from "./workforce-package.guard";
import { WorkforceHrSettingsService } from "./workforce-hr-settings.service";

class HrSettingsBody {
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  fiveDayWeeklyHours?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  sixDayWeeklyHours?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  medicalWeeklyHours?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  customWeeklyHours?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  advanceMaxPercent?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  advanceMaxAmount?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  advanceMaxOpen?: number | null;

  @IsOptional()
  @IsBoolean()
  advanceAllowHrProxy?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsInt()
  advancePayDay?: number | null;

  @IsOptional()
  @IsBoolean()
  allowEmployeeSubmit?: boolean;

  @IsOptional()
  @IsBoolean()
  allowManagerSubmit?: boolean;
}

class RouteStepBody {
  @IsIn([
    "REQUESTER_MANAGER",
    "ORG_UNIT_HEAD",
    "POSITION_IN_UNIT",
    "MANAGER_CHAIN",
    "POSITION_HOLDER",
    "MATRIX_MANAGER",
    "GRADE_AT_LEAST",
  ])
  kind!: string;

  @IsOptional()
  @IsUUID()
  orgUnitId?: string | null;

  @IsOptional()
  @IsUUID()
  positionId?: string | null;

  @IsOptional()
  @IsIn(["ALWAYS", "LEADERSHIP", "ORDINARY"])
  appliesTo?: string | null;

  @IsOptional()
  @IsBoolean()
  canExceedAdvanceCap?: boolean;

  @IsOptional()
  @IsInt()
  chainOffset?: number | null;

  @IsOptional()
  @IsInt()
  minGradeLevel?: number | null;
}

class SaveRouteBody {
  @IsIn(["FULL_DAY", "HOURLY", "ADVANCE", "VACATION"])
  kind!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteStepBody)
  steps!: RouteStepBody[];
}

@ApiTags("platform-workforce-hr-settings")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/hr-settings")
@RequireWorkforceFeature("absence")
@UseGuards(PermissionsGuard, WorkforcePackageGuard)
export class WorkforceHrSettingsController {
  constructor(private readonly settings: WorkforceHrSettingsService) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "Work-regime hours, advance limits, approval routes" })
  get(@OrganizationId() organizationId: string) {
    return this.settings.get(organizationId);
  }

  @Put()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  @ApiOperation({ summary: "Save weekly-hour and advance settings" })
  save(
    @OrganizationId() organizationId: string,
    @Body() body: HrSettingsBody,
  ) {
    return this.settings.saveSettings(organizationId, body);
  }

  @Put("routes")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ABSENCES)
  @ApiOperation({ summary: "Replace the org-structure route for one request kind" })
  saveRoute(
    @OrganizationId() organizationId: string,
    @Body() body: SaveRouteBody,
  ) {
    return this.settings.saveRoute(organizationId, body.kind, body.steps ?? []);
  }
}
