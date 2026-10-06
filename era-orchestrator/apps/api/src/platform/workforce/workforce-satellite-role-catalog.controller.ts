import {
  Body,
  Controller,
  Get,
  Headers,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { Public } from "../../auth/decorators/public.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { CP_PERMISSION } from "../../auth/cp-permissions";
import { assertMatchingServiceToken } from "../../common/utils/internal-service-token.util";
import { WorkforceSatelliteRoleCatalogService } from "./workforce-satellite-role-catalog.service";

class SatelliteRoleRowDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsBoolean()
  active!: boolean;
}

class PutSatelliteRolesDto {
  @IsUUID()
  organizationId!: string;

  @IsString()
  @MinLength(1)
  satelliteKey!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SatelliteRoleRowDto)
  roles?: SatelliteRoleRowDto[];

  /** True only for a full role list. A one-row push must not hide the others. */
  @IsOptional()
  @IsBoolean()
  snapshot?: boolean;
}

@Public()
@Controller("internal/v1/workforce/satellite-roles")
export class WorkforceSatelliteRoleIngestController {
  constructor(private readonly catalog: WorkforceSatelliteRoleCatalogService) {}

  @Put()
  put(
    @Body() dto: PutSatelliteRolesDto,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    assertMatchingServiceToken(auth, xToken);
    if (dto.roles?.length) {
      return this.catalog.replaceSnapshot(
        dto.organizationId,
        dto.satelliteKey,
        dto.roles,
        { replaceMissing: dto.snapshot === true },
      );
    }
    return this.catalog.upsert(dto.organizationId, dto.satelliteKey, {
      code: dto.code ?? "",
      name: dto.name ?? "",
      active: dto.active ?? true,
    });
  }
}

@ApiTags("platform-workforce-satellite-roles")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/satellite-roles")
@UseGuards(PermissionsGuard)
export class WorkforceSatelliteRoleCatalogController {
  constructor(private readonly catalog: WorkforceSatelliteRoleCatalogService) {}

  @Get()
  @RequirePermissions(CP_PERMISSION.API_WORKFORCE_ROLE_TEMPLATES)
  list(@OrganizationId() organizationId: string) {
    return this.catalog.list(organizationId);
  }
}
