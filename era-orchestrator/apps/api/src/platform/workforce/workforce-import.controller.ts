import {
  Body,
  Controller,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@era365/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { ImportCsvDto } from "./dto/workforce-import.dto";
import { WorkforceImportService } from "./workforce-import.service";
import { csvFromWorkforceImportBody } from "./workforce-xlsx";

@ApiTags("platform-workforce-import")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/import")
@UseGuards(RolesGuard)
export class WorkforceImportController {
  constructor(private readonly importService: WorkforceImportService) {}

  @Post("roster")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({
    summary:
      "Import roster from CSV/xlsx (dryRun supported). New hires need fin+fullName; empty satellites = headcount (no seat); ADDITIONAL workplace = second job without a seat.",
  })
  async roster(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query("dryRun") dryRun: string | undefined,
    @Body() body: ImportCsvDto,
  ) {
    return this.importService.importRoster(
      organizationId,
      user.sub,
      csvFromWorkforceImportBody(body),
      dryRun === "true" || dryRun === "1",
    );
  }

  @Post("absences")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({ summary: "Import absences from CSV (dryRun supported)" })
  async absences(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query("dryRun") dryRun: string | undefined,
    @Body() body: ImportCsvDto,
  ) {
    return this.importService.importAbsences(
      organizationId,
      user.sub,
      csvFromWorkforceImportBody(body),
      dryRun === "true" || dryRun === "1",
    );
  }

  @Post("org-structure")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  @ApiOperation({
    summary:
      "Import org units + positions from CSV/xlsx (dryRun supported). Idempotent upsert by name; does not delete extra rows.",
  })
  async orgStructure(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Query("dryRun") dryRun: string | undefined,
    @Body() body: ImportCsvDto,
  ) {
    return this.importService.importOrgStructure(
      organizationId,
      user.sub,
      csvFromWorkforceImportBody(body),
      dryRun === "true" || dryRun === "1",
    );
  }
}
