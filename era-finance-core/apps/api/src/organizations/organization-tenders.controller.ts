import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { IsArray, IsBoolean, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { TENDER_SEED_ROWS } from "@era/contracts";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { PrismaService } from "../prisma/prisma.service";

class TenderEnablementItemDto {
  @IsString()
  code!: string;

  @IsBoolean()
  enabled!: boolean;
}

class PutTenderEnablementDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenderEnablementItemDto)
  items!: TenderEnablementItemDto[];
}

@ApiTags("organization-tenders")
@ApiBearerAuth("bearer")
@Controller("organization/tenders")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationTendersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Org tender catalog (Finance SoR) — seed rows + enabled codes for satellites",
  })
  async list(@OrganizationId() organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings =
      org?.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};
    const raw = settings.tenderEnablement;
    const enabledCodes: string[] = Array.isArray(raw)
      ? raw.filter((c): c is string => typeof c === "string")
      : TENDER_SEED_ROWS.filter((r) => r.active).map((r) => r.code);
    return {
      tenders: TENDER_SEED_ROWS,
      enabledCodes,
    };
  }

  @Put()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update org tender enablement list" })
  async put(
    @OrganizationId() organizationId: string,
    @Body() dto: PutTenderEnablementDto,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const prev =
      org?.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};
    const enabledCodes = dto.items.filter((i) => i.enabled).map((i) => i.code);
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: {
          ...prev,
          tenderEnablement: enabledCodes,
        },
      },
    });
    return { tenders: TENDER_SEED_ROWS, enabledCodes };
  }
}
