import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { GenerateStatReportDto } from "./dto/generate-stat-report.dto";
import { StatformsService } from "./statforms.service";

@ApiTags("reporting-statforms")
@ApiBearerAuth("bearer")
@Controller("reporting/statforms")
@UseGuards(SubscriptionGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
export class StatformsController {
  constructor(private readonly statforms: StatformsService) {}

  @Get("definitions")
  @ApiOperation({ summary: "List active Goskomstat form definitions" })
  async listDefinitions(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.statforms.assertAccess(organizationId, {
      userEmail: user.email,
      isSuperAdmin: user.isSuperAdmin,
    });
    return this.statforms.listDefinitions();
  }

  @Get("exports")
  @ApiOperation({ summary: "List generated stat form exports for org" })
  async listExports(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.statforms.assertAccess(organizationId, {
      userEmail: user.email,
      isSuperAdmin: user.isSuperAdmin,
    });
    return this.statforms.listExports(organizationId);
  }

  @Post("generate")
  @ApiOperation({ summary: "Generate stat form XLSX for period" })
  async generate(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateStatReportDto,
  ) {
    await this.statforms.assertAccess(organizationId, {
      userEmail: user.email,
      isSuperAdmin: user.isSuperAdmin,
    });
    return this.statforms.generate(organizationId, dto);
  }

  @Get("exports/:id/download")
  @ApiOperation({ summary: "Download generated stat form file" })
  async download(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ): Promise<StreamableFile> {
    await this.statforms.assertAccess(organizationId, {
      userEmail: user.email,
      isSuperAdmin: user.isSuperAdmin,
    });
    const out = await this.statforms.download(organizationId, id);
    return new StreamableFile(out.buffer, {
      type: out.contentType,
      disposition: `attachment; filename="${out.filename}"`,
    });
  }
}
