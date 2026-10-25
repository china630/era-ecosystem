import { todayBakuYmd } from "@era/satellite-kit/time";
import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BankDirectoryService } from "../banking/bank-directory.service";
import { DataHubClientService } from "../data-hub/data-hub-client.service";
import {
  StockMovementReason,
  StockMovementType,
  UserRole,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { AZ_TAX_SCHEME_CODE, parseSchemeParams } from "../reporting/simplified-tax-watch.calc";
import { AZ_STATUTORY_SCHEME_PACKAGE } from "../reporting/tax-scheme-package";

const TEAM_INVITE_ROLES: UserRole[] = [
  UserRole.USER,
  UserRole.ACCOUNTANT,
  UserRole.DIRECTOR,
  UserRole.ADMIN,
];

@ApiTags("system")
@ApiBearerAuth("bearer")
@Controller("system")
@UseGuards(PermissionsGuard)
export class SystemCatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataHub: DataHubClientService,
    private readonly bankDirectory: BankDirectoryService,
  ) {}

  @Get("units-of-measure")
  @ApiOperation({ summary: "Active units of measure (global catalog)" })
  async listUnitsOfMeasure() {
    if (this.dataHub.isEnabled()) {
      const remote = await this.dataHub.getUom();
      if (remote?.units?.length) {
        return remote.units;
      }
    }
    return this.prisma.unitOfMeasure.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        code: true,
        nameAz: true,
        nameRu: true,
        nameEn: true,
      },
    });
  }

  @Get("currencies")
  @ApiOperation({ summary: "Active ISO 4217 currencies (global catalog)" })
  async listCurrencies() {
    if (this.dataHub.isEnabled()) {
      const remote = await this.dataHub.getCurrencies();
      if (remote?.currencies?.length) {
        return remote.currencies.map((c) => ({
          code: c.code,
          symbol: c.symbol,
          decimals: c.decimals,
          nameAz: c.nameAz,
          nameRu: c.nameRu,
          nameEn: c.nameEn,
        }));
      }
    }
    return this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        code: true,
        symbol: true,
        decimals: true,
        nameAz: true,
        nameRu: true,
        nameEn: true,
      },
    });
  }

  @Get("invoice-vat-rates")
  @ApiOperation({
    summary: "Invoice line VAT percent from the statutory scheme. Exemption and catalog percents are not offered.",
  })
  async listInvoiceVatRates(
    @Query("date") date?: string,
  ): Promise<{ rates: number[] }> {
    const fallback = Number(AZ_STATUTORY_SCHEME_PACKAGE.parameters.vatPercent);
    const day = date?.trim().slice(0, 10) || todayBakuYmd();
    const on = new Date(`${day}T00:00:00.000Z`);
    const row = await this.prisma.taxSchemeVersion.findFirst({
      where: {
        code: AZ_TAX_SCHEME_CODE,
        effectiveFrom: { lte: on },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: on } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!row) return { rates: [fallback] };
    try {
      const percent = Number(parseSchemeParams(row.parameters).vatPercent);
      if (Number.isFinite(percent) && percent >= 0) return { rates: [percent] };
    } catch {
      return { rates: [fallback] };
    }
    return { rates: [fallback] };
  }

  @Get("team-assignable-roles")
  @ApiOperation({ summary: "User roles allowed when inviting org members (API-driven list)" })
  teamAssignableRoles(): { roles: UserRole[] } {
    return { roles: [...TEAM_INVITE_ROLES] };
  }

  @Get("inventory-movement-enums")
  @ApiOperation({
    summary:
      "Stock movement type/reason enum values (matches Prisma; use for filters and UI consistency)",
  })
  @Get("banks")
  @ApiOperation({ summary: "Active banks (era-data-hub or local glossary)" })
  listBanks() {
    return this.bankDirectory.listBanks();
  }

  @Get("banks/:bankCode/branches/:branchCode")
  @ApiOperation({ summary: "Bank branch by MFO code" })
  getBankBranch(@Param("branchCode") branchCode: string) {
    return this.bankDirectory.getBranch(branchCode);
  }

  @Get("geo/countries")
  @ApiOperation({ summary: "Countries (era-data-hub or local geo seed)" })
  async listGeoCountries() {
    if (this.dataHub.isEnabled()) {
      const remote = await this.dataHub.getGeoCountries();
      if (remote?.countries?.length) {
        return remote.countries;
      }
    }
    return this.prisma.country.findMany({
      orderBy: [{ sortOrder: "asc" }, { iso2: "asc" }],
      select: { iso2: true, nameAz: true, nameRu: true, nameEn: true },
    });
  }

  inventoryMovementEnums(): {
    types: StockMovementType[];
    reasons: StockMovementReason[];
  } {
    return {
      types: Object.values(StockMovementType),
      reasons: Object.values(StockMovementReason),
    };
  }
}
