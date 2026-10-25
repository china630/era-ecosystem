import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Prisma } from "@era365/database";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { PrismaService } from "../prisma/prisma.service";
import { SatelliteOrgBindSyncService } from "./satellite-org-bind-sync.service";
import { DataHubAdminClient } from "./data-hub-admin.client";

class PolicyRowDto {
  @IsString()
  catalogKind!: string;

  @IsBoolean()
  externalFetchEnabled!: boolean;
}

class UpdateReferencePolicyDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyRowDto)
  policies?: PolicyRowDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fxDashboardCurrencyCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fxCbarCheckCurrencyCodes?: string[];
}

class UpdateOrgReferenceSourceDto {
  @IsIn(["hub", "excel"])
  referenceSource!: "hub" | "excel";
}

function readReferenceSource(settings: Prisma.JsonValue): "hub" | "excel" {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return "hub";
  const raw = (settings as Record<string, unknown>).referenceSource;
  return raw === "excel" ? "excel" : "hub";
}

@ApiTags("admin")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("v1/admin/reference")
export class AdminReferenceController {
  constructor(
    private readonly hub: DataHubAdminClient,
    private readonly prisma: PrismaService,
    private readonly sync: SatelliteOrgBindSyncService,
  ) {}

  @Get("policy")
  @ApiOperation({ summary: "Data-hub external fetch switches and FX code lists" })
  policy() {
    return this.hub.getPolicy();
  }

  @Patch("policy")
  @ApiOperation({ summary: "Update data-hub external fetch switches and FX code lists" })
  updatePolicy(@Body() body: UpdateReferencePolicyDto) {
    return this.hub.patchPolicy(body);
  }

  @Get("orgs")
  @ApiOperation({ summary: "Per-org reference source (hub or excel)" })
  async orgs() {
    const rows = await this.prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, publicOrgNumber: true, settings: true },
      orderBy: { name: "asc" },
      take: 200,
    });
    return {
      orgs: rows.map((row) => ({
        id: row.id,
        name: row.name,
        publicOrgNumber: row.publicOrgNumber,
        referenceSource: readReferenceSource(row.settings),
      })),
    };
  }

  @Patch("orgs/:orgId")
  @ApiOperation({ summary: "Set how this org reads reference data, then push runtime-config" })
  async updateOrg(
    @Param("orgId") orgId: string,
    @Body() body: UpdateOrgReferenceSourceDto,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, settings: true, deletedAt: true },
    });
    if (!org || org.deletedAt) {
      throw new BadRequestException("Organization not found");
    }
    const current =
      org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        settings: { ...current, referenceSource: body.referenceSource } as Prisma.InputJsonValue,
      },
    });
    const pushed = await this.sync.syncForOrg(orgId);
    return { id: orgId, referenceSource: body.referenceSource, sync: pushed };
  }
}
