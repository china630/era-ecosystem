import { CP_PERMISSION } from "@era/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  GoneException,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { getActorUserId } from "../common/actor-context";
import { ALL_MIGRATION_UPLOAD_KINDS } from "./migration-kinds";
import { MigrationAssembleService } from "./migration-assemble.service";
import { MigrationTemplateService } from "./migration-template.service";
import { MigrationUploadService } from "./migration-upload.service";

const FILE_LIMIT = 25 * 1024 * 1024;

@ApiTags("migration")
@ApiBearerAuth("bearer")
@Controller("migration")
export class MigrationController {
  constructor(
    private readonly templates: MigrationTemplateService,
    private readonly uploads: MigrationUploadService,
    private readonly assemble: MigrationAssembleService,
  ) {}

  @Get("status")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_MIGRATION_UPLOAD, CP_PERMISSION.API_MIGRATION_ASSEMBLE)
  @ApiOperation({ summary: "Migration machine status, drafts, checklist, upload log" })
  status(@OrganizationId() organizationId: string) {
    return this.assemble.status(organizationId);
  }

  @Get("kinds")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_MIGRATION_UPLOAD, CP_PERMISSION.API_MIGRATION_ASSEMBLE)
  @ApiOperation({ summary: "List upload kinds and template column keys" })
  kinds() {
    return { kinds: ALL_MIGRATION_UPLOAD_KINDS };
  }

  @Patch("cutover-date")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_MIGRATION_ASSEMBLE)
  @ApiOperation({ summary: "Set migration cutover date (YYYY-MM-DD)" })
  setCutover(
    @OrganizationId() organizationId: string,
    @Body() body: { cutoverDate?: string },
  ) {
    if (!body?.cutoverDate) throw new BadRequestException("cutoverDate required");
    return this.assemble.setCutoverDate(organizationId, body.cutoverDate);
  }

  @Get("templates/:kind.xlsx")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_MIGRATION_UPLOAD, CP_PERMISSION.API_MIGRATION_ASSEMBLE)
  @ApiOperation({ summary: "Download Excel template for a migration kind" })
  async template(
    @Param("kind") kind: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const clean = kind.replace(/\.xlsx$/i, "");
    const { filename, buffer } = await this.templates.templateBuffer(clean);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Post("uploads/:kind")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_MIGRATION_UPLOAD)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: FILE_LIMIT } }))
  @ApiOperation({ summary: "Upload master cards or staging draft for a kind" })
  upload(
    @OrganizationId() organizationId: string,
    @Param("kind") kind: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("file is required");
    return this.uploads.upload({
      organizationId,
      userId: getActorUserId(),
      kind,
      file,
    });
  }

  @Post("validate")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_MIGRATION_ASSEMBLE)
  @ApiOperation({ summary: "Validate staged drafts without posting" })
  validate(@OrganizationId() organizationId: string) {
    return this.assemble.validate(organizationId);
  }

  @Post("assemble")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_MIGRATION_ASSEMBLE)
  @ApiOperation({ summary: "Post staged opening drafts in one transaction" })
  assembleAll(@OrganizationId() organizationId: string) {
    return this.assemble.assemble(organizationId);
  }

  @Post("workforce/pull")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_MIGRATION_UPLOAD)
  @ApiOperation({
    summary: "Pull active CP employments into Finance Employee mirrors (no Excel)",
  })
  pullWorkforce(@OrganizationId() organizationId: string) {
    return this.assemble.pullWorkforce(organizationId);
  }
}

/** Legacy opening-balance POSTs — blocked in favour of draft + assemble. */
@ApiTags("migration-opening-balances")
@ApiBearerAuth("bearer")
@Controller("migration/opening-balances")
export class OpeningBalancesLegacyController {
  @Post("finance")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_MIGRATION_ASSEMBLE)
  @ApiOperation({ deprecated: true, summary: "Gone — use /api/migration drafts + assemble" })
  financeGone() {
    throw new GoneException(
      "Use POST /api/migration/uploads/cash-bank|capital then POST /api/migration/assemble",
    );
  }

  @Post("hr")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_MIGRATION_ASSEMBLE)
  @ApiOperation({ deprecated: true, summary: "Gone — pull workforce + hr-balances draft" })
  hrGone() {
    throw new GoneException(
      "Use POST /api/migration/workforce/pull and uploads/hr-balances then assemble",
    );
  }

  @Post("inventory")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_MIGRATION_ASSEMBLE)
  @ApiOperation({ deprecated: true, summary: "Gone — use stock draft + assemble" })
  inventoryGone() {
    throw new GoneException(
      "Use POST /api/migration/uploads/stock then POST /api/migration/assemble",
    );
  }
}
