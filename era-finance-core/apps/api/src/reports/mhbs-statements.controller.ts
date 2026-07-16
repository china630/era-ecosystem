import {
  BadRequestException,
  Controller,
  Get,
  Query,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { LedgerType, UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { parseLedgerTypeQuery } from "../common/ledger-type.util";
import { MhbsStatementsService } from "./mhbs-statements.service";

const MHBS_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.ACCOUNTANT,
  UserRole.DIRECTOR,
  UserRole.AUDITOR,
] as const;

@ApiBearerAuth("bearer")
@Controller("reports/statements")
@UseGuards(RolesGuard)
@Roles(...MHBS_ROLES)
export class MhbsStatementsController {
  constructor(private readonly mhbs: MhbsStatementsService) {}

  @Get("balance")
  @ApiOperation({ summary: "MHBS balance sheet (MoF line codes)" })
  balanceSheet(
    @OrganizationId() organizationId: string,
    @Query("asOfDate") asOfDate: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    if (!asOfDate?.trim()) {
      throw new BadRequestException("asOfDate is required (YYYY-MM-DD)");
    }
    return this.mhbs.balanceSheet(
      organizationId,
      asOfDate.trim(),
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
    );
  }

  @Get("pl")
  @ApiOperation({ summary: "MHBS income statement (MoF line codes)" })
  incomeStatement(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException("dateFrom and dateTo are required (YYYY-MM-DD)");
    }
    return this.mhbs.incomeStatement(
      organizationId,
      dateFrom.trim(),
      dateTo.trim(),
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
    );
  }

  @Get("cash-flow")
  @ApiOperation({ summary: "MHBS cash flow statement (MoF line codes)" })
  cashFlow(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException("dateFrom and dateTo are required (YYYY-MM-DD)");
    }
    return this.mhbs.cashFlowStatement(
      organizationId,
      dateFrom.trim(),
      dateTo.trim(),
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
    );
  }

  @Get("equity-changes")
  @ApiOperation({ summary: "MHBS statement of changes in equity" })
  equityChanges(
    @OrganizationId() organizationId: string,
    @Query("year") yearStr: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    const year = Number(yearStr);
    if (!Number.isFinite(year)) {
      throw new BadRequestException("year is required (e.g. 2026)");
    }
    return this.mhbs.equityChanges(
      organizationId,
      year,
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
    );
  }

  @Get("notes")
  @ApiOperation({ summary: "MHBS notes to financial statements (basic disclosures)" })
  notes(
    @OrganizationId() organizationId: string,
    @Query("asOfDate") asOfDate: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    if (!asOfDate?.trim()) {
      throw new BadRequestException("asOfDate is required (YYYY-MM-DD)");
    }
    return this.mhbs.notes(
      organizationId,
      asOfDate.trim(),
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
    );
  }

  @Get("balance/export")
  @ApiOperation({ summary: "Export MHBS balance sheet (XLSX/PDF)" })
  async balanceExport(
    @OrganizationId() organizationId: string,
    @Query("asOfDate") asOfDate: string,
    @Query("format") format: string,
    @Query("ledgerType") ledgerType?: string,
  ): Promise<StreamableFile> {
    const data = await this.mhbs.balanceSheet(
      organizationId,
      asOfDate,
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
    );
    return this.streamExport(data, format, `mhbs-balance-${asOfDate}`);
  }

  @Get("pl/export")
  @ApiOperation({ summary: "Export MHBS income statement (XLSX/PDF)" })
  async plExport(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("format") format: string,
    @Query("ledgerType") ledgerType?: string,
  ): Promise<StreamableFile> {
    const data = await this.mhbs.incomeStatement(
      organizationId,
      dateFrom,
      dateTo,
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
    );
    return this.streamExport(data, format, `mhbs-pl-${dateFrom}-${dateTo}`);
  }

  @Get("cash-flow/export")
  @ApiOperation({ summary: "Export MHBS cash flow (XLSX/PDF)" })
  async cashFlowExport(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("format") format: string,
    @Query("ledgerType") ledgerType?: string,
  ): Promise<StreamableFile> {
    const data = await this.mhbs.cashFlowStatement(
      organizationId,
      dateFrom,
      dateTo,
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
    );
    return this.streamExport(data, format, `mhbs-cash-flow-${dateFrom}-${dateTo}`);
  }

  @Get("equity-changes/export")
  @ApiOperation({ summary: "Export MHBS equity changes (XLSX/PDF)" })
  async equityExport(
    @OrganizationId() organizationId: string,
    @Query("year") yearStr: string,
    @Query("format") format: string,
    @Query("ledgerType") ledgerType?: string,
  ): Promise<StreamableFile> {
    const year = Number(yearStr);
    const data = await this.mhbs.equityChanges(
      organizationId,
      year,
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
    );
    return this.streamExport(data, format, `mhbs-equity-${year}`);
  }

  @Get("notes/export")
  @ApiOperation({ summary: "Export MHBS notes (XLSX/PDF)" })
  async notesExport(
    @OrganizationId() organizationId: string,
    @Query("asOfDate") asOfDate: string,
    @Query("format") format: string,
    @Query("ledgerType") ledgerType?: string,
  ): Promise<StreamableFile> {
    const data = await this.mhbs.notes(
      organizationId,
      asOfDate,
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
    );
    return this.streamExport(data, format, `mhbs-notes-${asOfDate}`);
  }

  private async streamExport(
    data: Awaited<ReturnType<MhbsStatementsService["balanceSheet"]>>,
    format: string,
    basename: string,
  ): Promise<StreamableFile> {
    const fmt = (format ?? "xlsx").toLowerCase();
    if (fmt === "xlsx") {
      const buffer = await this.mhbs.exportXlsx(data);
      return new StreamableFile(buffer, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        disposition: `attachment; filename="${basename}.xlsx"`,
      });
    }
    if (fmt === "pdf") {
      const buffer = await this.mhbs.exportPdf(data);
      return new StreamableFile(buffer, {
        type: "application/pdf",
        disposition: `attachment; filename="${basename}.pdf"`,
      });
    }
    throw new BadRequestException("format must be xlsx or pdf");
  }
}
