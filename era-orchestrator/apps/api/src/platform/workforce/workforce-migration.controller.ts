import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { ImportCsvDto } from "./dto/workforce-import.dto";
import { csvFromWorkforceImportBody } from "./workforce-xlsx";
import { WorkforceMigrationService } from "./workforce-migration.service";

function optionalCsv(body: ImportCsvDto): string {
  if (body.csv?.trim() || body.xlsxBase64?.trim()) {
    return csvFromWorkforceImportBody(body);
  }
  return "";
}

@ApiTags("platform-workforce-migration")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/migration")
@UseGuards(PermissionsGuard)
export class WorkforceMigrationController {
  constructor(private readonly migration: WorkforceMigrationService) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_IMPORT)
  @ApiOperation({ summary: "Migration wizard status for the JWT organization" })
  status(@OrganizationId() organizationId: string) {
    return this.migration.status(organizationId);
  }

  @Post(":stepId/preview")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_IMPORT)
  @ApiOperation({ summary: "Dry-run one migration step (CSV/xlsx)" })
  preview(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("stepId") stepId: string,
    @Body() body: ImportCsvDto,
  ) {
    return this.migration.preview(
      organizationId,
      user.sub,
      stepId,
      optionalCsv(body),
    );
  }

  @Post(":stepId/apply")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_IMPORT)
  @ApiOperation({ summary: "Apply one migration step (CSV/xlsx)" })
  apply(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("stepId") stepId: string,
    @Body() body: ImportCsvDto,
  ) {
    return this.migration.apply(
      organizationId,
      user.sub,
      stepId,
      optionalCsv(body),
    );
  }

  @Post(":stepId/skip")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_IMPORT)
  @ApiOperation({ summary: "Mark a skippable migration step as unused" })
  skip(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("stepId") stepId: string,
  ) {
    return this.migration.skip(organizationId, user.sub, stepId);
  }
}
