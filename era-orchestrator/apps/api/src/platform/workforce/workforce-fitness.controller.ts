import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequireWorkforceFeature, WorkforcePackageGuard } from "./workforce-package.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import { WorkforceFitnessService } from "./workforce-fitness.service";

class PatchFitnessPolicyDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredKinds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  criminalRecordFreshnessDays?: number;
}

class AttachFitnessDto {
  @IsString()
  kind!: string;

  @IsString()
  issuedOn!: string;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsString()
  fileBase64!: string;

  @IsString()
  fileName!: string;

  @IsString()
  contentType!: string;
}

@ApiTags("platform-workforce-fitness")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce")
@RequireWorkforceFeature("fitness")
@UseGuards(PermissionsGuard, WorkforcePackageGuard)
export class WorkforceFitnessController {
  constructor(private readonly fitness: WorkforceFitnessService) {}

  @Get("fitness/policy")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ORG)
  @ApiOperation({ summary: "Org fitness required kinds + criminal freshness days" })
  getPolicy(@OrganizationId() organizationId: string) {
    return this.fitness.getPolicy(organizationId);
  }

  @Patch("fitness/policy")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ORG)
  @ApiOperation({ summary: "Patch org fitness policy (empty requiredKinds = no gate)" })
  patchPolicy(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: PatchFitnessPolicyDto,
  ) {
    return this.fitness.patchPolicy(organizationId, user.sub, dto);
  }

  @Get("employments/:employmentId/fitness")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({ summary: "List fitness rows + computed status for one employment" })
  list(
    @OrganizationId() organizationId: string,
    @Param("employmentId") employmentId: string,
  ) {
    return this.fitness.listForEmployment(organizationId, employmentId);
  }

  @Post("employments/:employmentId/fitness")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_HIRE)
  @ApiOperation({ summary: "Attach/replace fitness file (PDF/JPEG/PNG)" })
  attach(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Param("employmentId") employmentId: string,
    @Body() dto: AttachFitnessDto,
  ) {
    if (!dto.fileBase64?.trim()) {
      throw new BadRequestException("fileBase64 required");
    }
    return this.fitness.attach(organizationId, user.sub, employmentId, dto);
  }

  @Get("employments/:employmentId/fitness/:kind/file")
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_READ)
  @ApiOperation({
    summary: "Download fitness file (HR only — not exposed to workforce.self)",
  })
  async download(
    @OrganizationId() organizationId: string,
    @Param("employmentId") employmentId: string,
    @Param("kind") kind: string,
  ): Promise<StreamableFile> {
    const file = await this.fitness.download(
      organizationId,
      employmentId,
      kind,
    );
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
    });
  }
}
