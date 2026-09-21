import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Body,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { LedgerType, UserRole, SignatureProvider } from "@erafinance/database";
import { OrganizationId } from "../common/org-id.decorator";
import { parseLedgerTypeQuery } from "../common/ledger-type.util";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReportingService } from "../reporting/reporting.service";
import { SignatureService } from "../signature/signature.service";
import { InitiateSignatureDto } from "../invoices/dto/initiate-signature.dto";
import { decryptText } from "../security/pii-crypto.util";
import { CashFlowService } from "./cash-flow.service";
import { FinancialReportService } from "./financial-report.service";
import { cashFlowPdfBuffer, cashFlowXlsxBuffer } from "./report-export.util";

const RECON_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.ACCOUNTANT,
  UserRole.DIRECTOR,
  UserRole.USER,
  UserRole.AUDITOR,
  UserRole.WAREHOUSE_KEEPER,
] as const;

@ApiTags("reports")
@ApiBearerAuth("bearer")
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly cashFlow: CashFlowService,
    private readonly financial: FinancialReportService,
    private readonly reporting: ReportingService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly signatures: SignatureService,
  ) {}

  @Get("cash-flow")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({ summary: "Cash Flow (direct method) by CashFlowItem" })
  cashFlowReport(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("cashDeskId") cashDeskId?: string,
    @Query("bankName") bankName?: string,
    @Query("ledgerType") ledgerType?: string,
    @Query("accountingBookId") accountingBookId?: string,
  ) {
    return this.cashFlow.getDirectCashFlow(organizationId, {
      dateFrom,
      dateTo,
      cashDeskId,
      bankName,
      ledgerType: parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
      accountingBookId,
    });
  }

  @Get("cash-flow/export")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({ summary: "Cash Flow export to PDF/XLSX" })
  async cashFlowExport(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("format") format: string,
    @Query("cashDeskId") cashDeskId?: string,
    @Query("bankName") bankName?: string,
    @Query("ledgerType") ledgerType?: string,
    @Query("accountingBookId") accountingBookId?: string,
  ): Promise<StreamableFile> {
    const data = await this.cashFlow.getDirectCashFlow(organizationId, {
      dateFrom,
      dateTo,
      cashDeskId,
      bankName,
      ledgerType: parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
      accountingBookId,
    });
    const fmt = (format ?? "").toLowerCase();
    if (fmt === "xlsx") {
      const buffer = await cashFlowXlsxBuffer(data);
      return new StreamableFile(buffer, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        disposition: `attachment; filename="cash-flow-${dateFrom}-${dateTo}.xlsx"`,
      });
    }
    const buffer = await cashFlowPdfBuffer(data);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="cash-flow-${dateFrom}-${dateTo}.pdf"`,
    });
  }

  @Get("balance-sheet")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({ summary: "Balance Sheet (management) as of date" })
  balanceSheet(
    @OrganizationId() organizationId: string,
    @Query("asOfDate") asOfDate: string,
    @Query("ledgerType") ledgerType?: string,
    @Query("accountingBookId") accountingBookId?: string,
  ) {
    return this.financial.generateBalanceSheet(
      organizationId,
      asOfDate,
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
      accountingBookId,
    );
  }

  @Get("executive-widgets")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({
    summary:
      "Executive widgets: cash, AR (211), vendor AP (531), payroll/tax AP (521+523), net profit MTD",
  })
  executiveWidgets(
    @OrganizationId() organizationId: string,
    @Query("ledgerType") ledgerType?: string,
    @Query("accountingBookId") accountingBookId?: string,
  ) {
    return this.financial.executiveWidgets(
      organizationId,
      parseLedgerTypeQuery(ledgerType) ?? LedgerType.NAS,
      accountingBookId,
    );
  }

  @Get("reconciliation/:counterpartyId")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({
    summary:
      "Акт сверки взаиморасчётов (Üzləşmə aktı): сальдо, проводки журнала, обороты за период",
  })
  reconciliationAct(
    @OrganizationId() organizationId: string,
    @Param("counterpartyId") counterpartyId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("currency") currency?: string,
    @Query("ledgerType") ledgerType?: string,
    @Query("accountingBookId") accountingBookId?: string,
  ) {
    const from = dateFrom ?? startDate;
    const to = dateTo ?? endDate;
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException(
        "startDate and endDate (or dateFrom/dateTo) are required (YYYY-MM-DD)",
      );
    }
    return this.reporting.counterpartyReconciliation(
      organizationId,
      counterpartyId,
      from.trim(),
      to.trim(),
      {
        currency: currency ?? null,
        ledgerType: parseLedgerTypeQuery(ledgerType) ?? undefined,
        accountingBookId,
      },
    );
  }

  @Get("reconciliation/:counterpartyId/pdf")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({ summary: "PDF акта сверки (AZ)" })
  async reconciliationActPdf(
    @OrganizationId() organizationId: string,
    @Param("counterpartyId") counterpartyId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("currency") currency?: string,
    @Query("ledgerType") ledgerType?: string,
    @Query("accountingBookId") accountingBookId?: string,
  ): Promise<StreamableFile> {
    const from = dateFrom ?? startDate;
    const to = dateTo ?? endDate;
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException(
        "startDate and endDate (or dateFrom/dateTo) are required (YYYY-MM-DD)",
      );
    }
    const { buffer, filename } = await this.reporting.counterpartyReconciliationPdf(
      organizationId,
      counterpartyId,
      from.trim(),
      to.trim(),
      {
        currency: currency ?? null,
        ledgerType: parseLedgerTypeQuery(ledgerType) ?? undefined,
        accountingBookId,
      },
    );
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get("reconciliation/:counterpartyId/xlsx")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({ summary: "Excel: акт сверки (строки журнала и сальдо)" })
  async reconciliationActXlsx(
    @OrganizationId() organizationId: string,
    @Param("counterpartyId") counterpartyId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("currency") currency?: string,
    @Query("ledgerType") ledgerType?: string,
    @Query("accountingBookId") accountingBookId?: string,
  ): Promise<StreamableFile> {
    const from = dateFrom ?? startDate;
    const to = dateTo ?? endDate;
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException(
        "startDate and endDate (or dateFrom/dateTo) are required (YYYY-MM-DD)",
      );
    }
    const { buffer, filename } = await this.reporting.counterpartyReconciliationXlsx(
      organizationId,
      counterpartyId,
      from.trim(),
      to.trim(),
      {
        currency: currency ?? null,
        ledgerType: parseLedgerTypeQuery(ledgerType) ?? undefined,
        accountingBookId,
      },
    );
    return new StreamableFile(buffer, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post("reconciliation/:counterpartyId/signature/initiate")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({
    summary:
      "Initiate ASAN İmza / SİMA signature for reconciliation act PDF (period query params required)",
  })
  initiateReconciliationSignature(
    @OrganizationId() organizationId: string,
    @Param("counterpartyId") counterpartyId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Body() dto?: InitiateSignatureDto,
  ) {
    const from = dateFrom ?? startDate;
    const to = dateTo ?? endDate;
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException(
        "dateFrom and dateTo (or startDate/endDate) are required (YYYY-MM-DD)",
      );
    }
    return this.signatures.initiateReconciliationSignature(
      organizationId,
      counterpartyId,
      from.trim(),
      to.trim(),
      dto?.provider ?? SignatureProvider.ASAN_IMZA,
    );
  }

  @Get("reconciliation/:counterpartyId/signature/:logId/status")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({ summary: "Poll reconciliation act signature session" })
  reconciliationSignatureStatus(
    @OrganizationId() organizationId: string,
    @Param("counterpartyId") counterpartyId: string,
    @Param("logId") logId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const from = dateFrom ?? startDate;
    const to = dateTo ?? endDate;
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException(
        "dateFrom and dateTo (or startDate/endDate) are required (YYYY-MM-DD)",
      );
    }
    return this.signatures.getReconciliationSignatureStatus(
      organizationId,
      counterpartyId,
      from.trim(),
      to.trim(),
      logId,
    );
  }

  @Post("reconciliation/:counterpartyId/email")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({
    summary: "Отправить PDF акта сверки на email контрагента (если указан и настроен SMTP)",
  })
  async emailReconciliationAct(
    @OrganizationId() organizationId: string,
    @Param("counterpartyId") counterpartyId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("currency") currency?: string,
    @Query("ledgerType") ledgerType?: string,
    @Query("accountingBookId") accountingBookId?: string,
  ): Promise<{ ok: boolean; sentTo: string }> {
    const from = dateFrom ?? startDate;
    const to = dateTo ?? endDate;
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException(
        "startDate and endDate (or dateFrom/dateTo) are required (YYYY-MM-DD)",
      );
    }
    const cp = await this.prisma.counterparty.findFirst({
      where: { id: counterpartyId, organizationId },
    });
    if (!cp) {
      throw new NotFoundException("Counterparty not found");
    }
    const email = cp.email?.trim();
    if (!email) {
      throw new BadRequestException("У контрагента не указан email");
    }
    if (!this.mail.isConfigured()) {
      throw new BadRequestException("SMTP не настроен (SMTP_HOST)");
    }
    const { buffer, filename } = await this.reporting.counterpartyReconciliationPdf(
      organizationId,
      counterpartyId,
      from.trim(),
      to.trim(),
      {
        currency: currency ?? null,
        ledgerType: parseLedgerTypeQuery(ledgerType) ?? undefined,
        accountingBookId,
      },
    );
    await this.mail.sendMail({
      to: email,
      subject: `Акт сверки ${cp.nameCipher ? decryptText(cp.nameCipher) ?? "" : ""} (${from} — ${to})`,
      text: `Во вложении акт сверки взаиморасчётов за период ${from} — ${to}.`,
      attachments: [
        {
          filename,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });
    return { ok: true, sentTo: email };
  }
}
