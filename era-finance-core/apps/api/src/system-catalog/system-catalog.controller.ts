import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BankDirectoryService } from "../banking/bank-directory.service";
import { DataHubClientService } from "../data-hub/data-hub-client.service";
import {
  StockMovementReason,
  StockMovementType,
  TaxRateKind,
  UserRole,
} from "@erafinance/database";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_INVOICE_VAT_RATES = [-1, 0, 2, 8, 18] as const;

/** Roles that may be assigned via team invite (excludes OWNER). */
const TEAM_INVITE_ROLES: UserRole[] = [
  UserRole.USER,
  UserRole.ACCOUNTANT,
  UserRole.DIRECTOR,
  UserRole.ADMIN,
];

@ApiTags("system")
@ApiBearerAuth("bearer")
@Controller("system")
@UseGuards(RolesGuard)
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
    summary:
      "Allowed ƏDV/НДС line percents for invoices (from tax_rates; fallback to product default list)",
  })
  async listInvoiceVatRates(
    @Query("date") date?: string,
  ): Promise<{ rates: number[] }> {
    if (this.dataHub.isEnabled()) {
      const remote = await this.dataHub.getTaxRates("VAT", date);
      if (remote?.rates?.length) {
        const rates = new Set<number>();
        for (const r of remote.rates) {
          const code = r.code.toUpperCase();
          if (code.includes("EXEMPT")) {
            rates.add(-1);
            continue;
          }
          const p = Number(r.percent);
          if (Number.isFinite(p)) {
            rates.add(Math.round(p * 10000) / 10000);
          }
        }
        if (rates.size > 0) {
          return { rates: [...rates].sort((a, b) => a - b) };
        }
      }
    }
    const rows = await this.prisma.taxRate.findMany({
      where: { kind: TaxRateKind.VAT, isActive: true },
      select: { code: true, percent: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    const rates = new Set<number>();
    for (const r of rows) {
      const code = r.code.toUpperCase();
      if (code.includes("EXEMPT")) {
        rates.add(-1);
        continue;
      }
      const p = Number(r.percent);
      if (!Number.isFinite(p)) {
        continue;
      }
      const rounded = Math.round(p * 10000) / 10000;
      rates.add(rounded);
    }
    if (rates.size === 0) {
      return { rates: [...DEFAULT_INVOICE_VAT_RATES] };
    }
    return { rates: [...rates].sort((a, b) => a - b) };
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
