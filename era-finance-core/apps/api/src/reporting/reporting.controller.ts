import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { requireOrgRole } from "../auth/require-org-role";
import type { AuthUser } from "../auth/types/auth-user";
import { RolesGuard } from "../auth/guards/roles.guard";
import { VoenIntegrityGuard } from "../auth/guards/voen-integrity.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { parseLedgerTypeQuery } from "../common/ledger-type.util";
import { FinanceService } from "../finance/finance.service";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ClosePeriodDto } from "./dto/close-period.dto";
import { CreateNettingDto } from "./dto/create-netting.dto";
import { CreateProfitTaxAdjustmentDto } from "./dto/create-profit-tax-adjustment.dto";
import { UpdateProfitTaxAdjustmentDto } from "./dto/update-profit-tax-adjustment.dto";
import { ETaxesIntegrationService } from "./etaxes-integration.service";
import { GenerateTaxDeclarationDto } from "./dto/generate-tax-declaration.dto";
import { ProfitTaxService } from "./profit-tax.service";
import { ReportingService } from "./reporting.service";
import { TaxExportService } from "./tax-export.service";
import { VatAppendixExportService } from "./vat-appendix-export.service";
import {
  plPdfBuffer,
  plXlsxBuffer,
  trialBalancePdfBuffer,
  trialBalanceXlsxBuffer,
} from "../reports/report-export.util";

@ApiTags("reporting")
@ApiBearerAuth("bearer")
@Controller("reporting")
export class ReportingController {
  constructor(
    private readonly reporting: ReportingService,
    private readonly vatAppendix: VatAppendixExportService,
    private readonly etaxes: ETaxesIntegrationService,
    private readonly taxExport: TaxExportService,
    private readonly profitTax: ProfitTaxService,
    private readonly finance: FinanceService,
  ) {}

  @Get("trial-balance")
  @ApiOperation({ summary: "Оборотно-сальдовая ведомость за период" })
  trialBalance(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    return this.reporting.trialBalance(
      organizationId,
      dateFrom,
      dateTo,
      parseLedgerTypeQuery(ledgerType),
    );
  }

  @Get("trial-balance/export")
  @ApiOperation({ summary: "Export Trial Balance to PDF/XLSX" })
  async trialBalanceExport(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("format") format: string,
    @Query("ledgerType") ledgerType?: string,
  ): Promise<StreamableFile> {
    const data = await this.reporting.trialBalance(
      organizationId,
      dateFrom,
      dateTo,
      parseLedgerTypeQuery(ledgerType),
    );
    const fmt = (format ?? "").toLowerCase();
    if (fmt === "xlsx") {
      const buffer = await trialBalanceXlsxBuffer(data);
      return new StreamableFile(buffer, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        disposition: `attachment; filename="trial-balance-${dateFrom}-${dateTo}.xlsx"`,
      });
    }
    const buffer = await trialBalancePdfBuffer(data);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="trial-balance-${dateFrom}-${dateTo}.pdf"`,
    });
  }

  @Get("pl")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.USER,
    UserRole.AUDITOR,
    UserRole.WAREHOUSE_KEEPER,
  )
  @ApiOperation({ summary: "P&L по проводкам (начисление)" })
  profitAndLoss(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("ledgerType") ledgerType?: string,
    @Query("departmentId") departmentId?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const requestedDepartment = departmentId?.trim();
    const role = user ? requireOrgRole(user) : null;
    if (
      requestedDepartment &&
      role !== UserRole.OWNER &&
      role !== UserRole.ACCOUNTANT &&
      role !== UserRole.DIRECTOR &&
      role !== UserRole.ADMIN
    ) {
      throw new BadRequestException(
        "Department filter is available only for OWNER, ADMIN, ACCOUNTANT, and DIRECTOR",
      );
    }
    return this.reporting.profitAndLoss(
      organizationId,
      dateFrom,
      dateTo,
      parseLedgerTypeQuery(ledgerType),
      requestedDepartment,
    );
  }

  @Get("pl/export")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.USER,
    UserRole.AUDITOR,
    UserRole.WAREHOUSE_KEEPER,
  )
  @ApiOperation({ summary: "Export Profit&Loss to PDF/XLSX" })
  async profitAndLossExport(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("format") format: string,
    @Query("ledgerType") ledgerType?: string,
    @Query("departmentId") departmentId?: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<StreamableFile> {
    const requestedDepartment = departmentId?.trim();
    const role = user ? requireOrgRole(user) : null;
    if (
      requestedDepartment &&
      role !== UserRole.OWNER &&
      role !== UserRole.ACCOUNTANT &&
      role !== UserRole.DIRECTOR &&
      role !== UserRole.ADMIN
    ) {
      throw new BadRequestException(
        "Department filter is available only for OWNER, ADMIN, ACCOUNTANT, and DIRECTOR",
      );
    }
    const data = await this.reporting.profitAndLoss(
      organizationId,
      dateFrom,
      dateTo,
      parseLedgerTypeQuery(ledgerType),
      requestedDepartment,
    );
    const fmt = (format ?? "").toLowerCase();
    if (fmt === "xlsx") {
      const buffer = await plXlsxBuffer(data);
      return new StreamableFile(buffer, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        disposition: `attachment; filename="pl-${dateFrom}-${dateTo}.xlsx"`,
      });
    }
    const buffer = await plPdfBuffer(data);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="pl-${dateFrom}-${dateTo}.pdf"`,
    });
  }

  @Get("dashboard")
  @ApiOperation({
    summary:
      "Виджеты главной: касса/банк, обязательства 521+531, расходы 721 за месяц, топ товаров, выручка 30 дн.",
  })
  dashboard(
    @OrganizationId() organizationId: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    return this.reporting.dashboard(
      organizationId,
      parseLedgerTypeQuery(ledgerType),
    );
  }

  @Get("period-status")
  @ApiOperation({
    summary: "Статус закрытия текущего UTC-месяца (Maliyyə dövrü / виджет главной)",
  })
  periodStatus(@OrganizationId() organizationId: string) {
    return this.reporting.getPeriodStatus(organizationId);
  }

  @Get("close-period-prompt")
  @ApiOperation({
    summary:
      "Нужно ли показывать блок закрытия месяца: самый ранний незакрытый прошедший UTC-месяц",
  })
  closePeriodPrompt(@OrganizationId() organizationId: string) {
    return this.reporting.getClosePeriodPrompt(organizationId);
  }

  @Get("dashboard-mini")
  @ApiOperation({
    summary:
      "Краткие P&L / баланс / движение денег (101+221) за текущий UTC-месяц для главной",
  })
  dashboardMini(
    @OrganizationId() organizationId: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    return this.reporting.dashboardMiniFinancials(
      organizationId,
      parseLedgerTypeQuery(ledgerType),
    );
  }

  @Get("receivables")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.USER,
    UserRole.AUDITOR,
    UserRole.WAREHOUSE_KEEPER,
  )
  @ApiOperation({
    summary: "Дебиторка (счёт 211): долг контрагентов с начисленной выручкой без оплаты",
  })
  receivables(
    @OrganizationId() organizationId: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    return this.reporting.accountsReceivable(
      organizationId,
      parseLedgerTypeQuery(ledgerType),
    );
  }

  @Get("netting/preview")
  @ApiOperation({
    summary:
      "Кандидат на взаимозачёт (FinanceService.getNettingCandidate): 211, 531, min, canNet",
  })
  nettingPreview(
    @OrganizationId() organizationId: string,
    @Query("counterpartyId") counterpartyId: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    if (!counterpartyId?.trim()) {
      throw new BadRequestException("counterpartyId is required");
    }
    return this.finance.getNettingCandidate(
      organizationId,
      counterpartyId,
      parseLedgerTypeQuery(ledgerType),
    );
  }

  @Post("netting")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary: "Взаимозачёт (FinanceService.executeNetting): Дт 531 — Кт 211",
  })
  createNetting(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateNettingDto,
    @Query("ledgerType") ledgerType?: string,
  ) {
    return this.finance.executeNetting(
      organizationId,
      dto.counterpartyId,
      dto.amount,
      parseLedgerTypeQuery(ledgerType),
      requireOrgRole(user),
      {
        userId: user.userId,
        previewSuggestedAmount: dto.previewSuggestedAmount,
      },
    );
  }

  @Get("reconciliation")
  @ApiOperation({
    summary:
      "Акт сверки с контрагентом: сальдо, обороты по счетам и платежам за период",
  })
  reconciliation(
    @OrganizationId() organizationId: string,
    @Query("counterpartyId") counterpartyId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("currency") currency?: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    const from = dateFrom ?? startDate;
    const to = dateTo ?? endDate;
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException(
        "dateFrom/dateTo or startDate/endDate are required (YYYY-MM-DD)",
      );
    }
    return this.reporting.counterpartyReconciliation(
      organizationId,
      counterpartyId,
      from,
      to,
      {
        currency: currency ?? null,
        ledgerType: parseLedgerTypeQuery(ledgerType) ?? undefined,
      },
    );
  }

  @Get("reconciliation/pdf")
  @ApiOperation({
    summary:
      "PDF акта сверки (AZ): qarşılıqlı hesablaşma, cədvəl, imzalar",
  })
  async reconciliationPdf(
    @OrganizationId() organizationId: string,
    @Query("counterpartyId") counterpartyId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("currency") currency?: string,
    @Query("ledgerType") ledgerType?: string,
  ): Promise<StreamableFile> {
    const from = dateFrom ?? startDate;
    const to = dateTo ?? endDate;
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException(
        "dateFrom/dateTo or startDate/endDate are required (YYYY-MM-DD)",
      );
    }
    const { buffer, filename } =
      await this.reporting.counterpartyReconciliationPdf(
        organizationId,
        counterpartyId,
        from,
        to,
        {
          currency: currency ?? null,
          ledgerType: parseLedgerTypeQuery(ledgerType) ?? undefined,
        },
      );
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get("aging")
  @ApiOperation({
    summary:
      "AR Aging: старение дебиторки (0-30 / 31-60 / 61-90 / 90+), date asOf optional",
  })
  aging(
    @OrganizationId() organizationId: string,
    @Query("asOf") asOf?: string,
  ) {
    return this.reporting.accountsReceivableAging(organizationId, asOf);
  }

  @Get("ar-aging")
  @ApiOperation({
    summary:
      "AR Aging Report: неоплаченные инвойсы по корзинам просрочки 0-30 / 31-60 / 61-90 / 90+",
  })
  arAging(
    @OrganizationId() organizationId: string,
    @Query("asOf") asOf?: string,
  ) {
    return this.reporting.accountsReceivableAging(organizationId, asOf);
  }

  @Get("ap-aging")
  @ApiOperation({
    summary:
      "AP Aging: старение кредиторки 531 (0-30 / 31-60 / 61-90 / 90+), date asOf optional",
  })
  apAging(
    @OrganizationId() organizationId: string,
    @Query("asOf") asOf?: string,
  ) {
    return this.reporting.accountsPayableAging(organizationId, asOf);
  }

  @Get("creditor-payment-plan")
  @ApiOperation({
    summary:
      "План платежей кредиторам: непогашенные обязательства 531 + suggestedPayDate",
  })
  creditorPaymentPlan(
    @OrganizationId() organizationId: string,
    @Query("asOf") asOf?: string,
  ) {
    return this.reporting.creditorPaymentPlan(organizationId, asOf);
  }

  @Get("subconto-analysis")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({
    summary:
      "Subconto / BRANCH analysis (ERA_SUBCONTO_ENABLED); filter by type code + valueRef",
  })
  subcontoAnalysis(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("subcontoTypeCode") subcontoTypeCode?: string,
    @Query("valueRef") valueRef?: string,
  ) {
    return this.reporting.subcontoAnalysis(organizationId, {
      dateFrom,
      dateTo,
      subcontoTypeCode,
      valueRef,
    });
  }

  @Get("vat-appendix-xlsx")
  @UseGuards(VoenIntegrityGuard)
  @ApiOperation({
    summary:
      "Excel: список продаж/покупок с НДС за квартал (e-taxes.gov.az, приложение к декларации)",
  })
  async vatAppendixXlsx(
    @OrganizationId() organizationId: string,
    @Query("year") yearStr: string,
    @Query("quarter") quarterStr: string,
  ): Promise<StreamableFile> {
    const year = Number(yearStr);
    const quarter = Number(quarterStr);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Invalid year");
    }
    if (!Number.isFinite(quarter) || quarter < 1 || quarter > 4) {
      throw new BadRequestException("Invalid quarter (1–4)");
    }
    const { buffer, filename } =
      await this.vatAppendix.buildQuarterlyXlsxBuffer(
        organizationId,
        year,
        quarter,
      );
    return new StreamableFile(buffer, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get("etaxes-vat-declaration")
  @UseGuards(VoenIntegrityGuard)
  @ApiOperation({
    summary:
      "JSON-пакет ƏDV əlavəsi (e-taxes.gov.az / BTP sahələri) və yoxlama nəticəsi",
  })
  etaxesVatDeclarationPreview(
    @OrganizationId() organizationId: string,
    @Query("year") yearStr: string,
    @Query("quarter") quarterStr: string,
  ) {
    const year = Number(yearStr);
    const quarter = Number(quarterStr);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Invalid year");
    }
    if (!Number.isFinite(quarter) || quarter < 1 || quarter > 4) {
      throw new BadRequestException("Invalid quarter (1–4)");
    }
    return this.etaxes.buildDeclarationPackage(organizationId, year, quarter);
  }

  @Post("etaxes-vat-declaration/submit")
  @UseGuards(VoenIntegrityGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary: "ƏDV paketini vergi şlüzünə göndər (E_TAXES_VAT_SUBMIT_URL)",
  })
  etaxesVatDeclarationSubmit(
    @OrganizationId() organizationId: string,
    @Query("year") yearStr: string,
    @Query("quarter") quarterStr: string,
  ) {
    const year = Number(yearStr);
    const quarter = Number(quarterStr);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Invalid year");
    }
    if (!Number.isFinite(quarter) || quarter < 1 || quarter > 4) {
      throw new BadRequestException("Invalid quarter (1–4)");
    }
    return this.etaxes.submitDeclarationToGateway(organizationId, year, quarter);
  }

  @Get("eqf-registry")
  @UseGuards(VoenIntegrityGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.DIRECTOR)
  @ApiOperation({
    summary:
      "EQF / e-Qaimə registry by debtor (eqaime* + dvxSync* on sales invoices)",
  })
  eqfRegistry(
    @OrganizationId() organizationId: string,
    @Query("counterpartyId") counterpartyId?: string,
    @Query("status") status?: string,
  ) {
    return this.reporting.listEqfRegistry(organizationId, {
      counterpartyId,
      status,
    });
  }

  @Get("tax-declarations")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary: "List e-Taxes declaration exports with workflow statuses",
  })
  listTaxDeclarations(@OrganizationId() organizationId: string) {
    return this.taxExport.list(organizationId);
  }

  @Post("tax-declarations/generate")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Generate declaration file (SIMPLIFIED_TAX / PROFIT_TAX / PAYROLL_WITHHOLDING / PROPERTY_TAX)",
  })
  generateTaxDeclaration(
    @OrganizationId() organizationId: string,
    @Body() dto: GenerateTaxDeclarationDto,
  ) {
    return this.taxExport.generate(organizationId, dto);
  }

  @Get("tax-declarations/:id/download")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary: "Download generated declaration file and mark as UPLOADED",
  })
  async downloadTaxDeclaration(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ): Promise<StreamableFile> {
    const out = await this.taxExport.downloadGenerated(organizationId, id);
    return new StreamableFile(out.buffer, {
      type: out.contentType,
      disposition: `attachment; filename="${out.filename}"`,
    });
  }

  @Post("tax-declarations/:id/receipt")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
      required: ["file"],
    },
  })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({
    summary: "Attach Elektron Bildiriş PDF and mark declaration CONFIRMED_BY_TAX",
  })
  attachReceipt(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.taxExport.attachReceipt(organizationId, id, file);
  }

  @Get("profit-tax/adjustments")
  @UseGuards(SubscriptionGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "List profit tax book-to-tax adjustments for year" })
  listProfitTaxAdjustments(
    @OrganizationId() organizationId: string,
    @Query("year") yearStr: string,
  ) {
    const year = Number(yearStr);
    if (!Number.isFinite(year)) {
      throw new BadRequestException("year is required");
    }
    return this.profitTax.listAdjustments(organizationId, year);
  }

  @Post("profit-tax/adjustments")
  @UseGuards(SubscriptionGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create manual profit tax adjustment" })
  createProfitTaxAdjustment(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateProfitTaxAdjustmentDto,
  ) {
    return this.profitTax.createManual(organizationId, dto);
  }

  @Patch("profit-tax/adjustments/:id")
  @UseGuards(SubscriptionGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Update manual profit tax adjustment" })
  updateProfitTaxAdjustment(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateProfitTaxAdjustmentDto,
  ) {
    return this.profitTax.updateManual(organizationId, id, dto);
  }

  @Delete("profit-tax/adjustments/:id")
  @UseGuards(SubscriptionGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Soft-delete manual profit tax adjustment" })
  deleteProfitTaxAdjustment(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.profitTax.softDelete(organizationId, id);
  }

  @Get("profit-tax/preview")
  @UseGuards(SubscriptionGuard, RolesGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Preview annual profit tax aggregation" })
  previewProfitTax(
    @OrganizationId() organizationId: string,
    @Query("year") yearStr: string,
  ) {
    const year = Number(yearStr);
    if (!Number.isFinite(year)) {
      throw new BadRequestException("year is required");
    }
    return this.profitTax.preview(organizationId, year);
  }

  @Post("close-period")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Закрыть месяц: isLocked + запись в settings.reporting.closedPeriods" })
  closePeriod(
    @OrganizationId() organizationId: string,
    @Body() dto: ClosePeriodDto,
  ) {
    return this.reporting.closePeriod(organizationId, dto.year, dto.month);
  }
}
