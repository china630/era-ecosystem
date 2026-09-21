import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { requireOrgPolicySubject } from "../auth/policies/policy-subject";
import { requireOrgRole } from "../auth/require-org-role";
import type { AuthUser } from "../auth/types/auth-user";
import { CheckQuota } from "../common/decorators/check-quota.decorator";
import { QuotaGuard } from "../common/guards/quota.guard";
import { VoenIntegrityGuard } from "../auth/guards/voen-integrity.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { QuotaResource } from "../quota/quota-resource";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { AllocatePaymentDto } from "./dto/allocate-payment.dto";
import { RecordInvoicePaymentDto } from "./dto/record-invoice-payment.dto";
import { CreateInvoiceCreditAdjustmentDto } from "./dto/create-invoice-credit-adjustment.dto";
import { UpdateInvoiceStatusDto } from "./dto/update-invoice-status.dto";
import { BulkPrefillInvoicesDto } from "./dto/bulk-prefill-invoices.dto";
import { BulkSyncResultInvoicesDto } from "./dto/bulk-sync-result-invoices.dto";
import { PatchInvoiceDto } from "./dto/patch-invoice.dto";
import { InvoicesService } from "./invoices.service";
import { EqaimeSubmissionService } from "./eqaime-submission.service";

@ApiTags("invoices")
@ApiBearerAuth("bearer")
@Controller("invoices")
@UseGuards(PermissionsGuard)
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly eqaime: EqaimeSubmissionService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Список инвойсов организации" })
  list(
    @OrganizationId() orgId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
    @Query("counterpartyId") counterpartyId?: string,
    @Query("status") status?: string,
    @Query("dueFrom") dueFrom?: string,
    @Query("dueTo") dueTo?: string,
    @Query("sortKey") sortKey?: string,
    @Query("sortDir") sortDir?: string,
  ) {
    return this.invoices.list(orgId, {
      page,
      pageSize,
      counterpartyId: counterpartyId?.trim() || undefined,
      status: status?.trim() || undefined,
      dueFrom: dueFrom?.trim() || undefined,
      dueTo: dueTo?.trim() || undefined,
      sortKey: sortKey?.trim() || undefined,
      sortDir: sortDir?.trim() || undefined,
    });
  }

  @Post(":id/payments")
  @Permissions(CP_PERMISSION.API_INVOICES_UPDATE)
  @ApiOperation({
    summary:
      "Записать оплату (частичную или полную). Статус PAID только при полной выплате.",
  })
  recordPayment(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Body() dto: RecordInvoicePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.recordPayment(
      orgId,
      id,
      {
        amount: dto.amount,
        paymentDate: dto.paymentDate,
        debitAccountCode: dto.debitAccountCode,
      },
      requireOrgRole(user),
    );
  }

  @Post(":id/credit-adjustment")
  @Permissions(CP_PERMISSION.API_INVOICES_UPDATE)
  @ApiOperation({
    summary:
      "Credit-adjust invoice remaining (Dr revenue/expense Cr 211) without changing original invoice lines",
  })
  creditAdjustment(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Body() dto: CreateInvoiceCreditAdjustmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.applyCreditAdjustment(orgId, id, dto, requireOrgPolicySubject(user));
  }

  @Post("payments/allocate")
  @Permissions(CP_PERMISSION.API_INVOICES_UPDATE)
  @ApiOperation({
    summary:
      "Распределить один транш оплаты на несколько инвойсов контрагента (FIFO по дате счёта)",
  })
  allocatePayment(
    @OrganizationId() orgId: string,
    @Body() dto: AllocatePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.allocatePaymentAcrossInvoices(
      orgId,
      dto,
      requireOrgRole(user),
    );
  }

  @Get(":id/print-snapshot")
  @ApiOperation({
    summary:
      "W3 commercial invoice print snapshot (flat placeholders + lines; not fiscal)",
  })
  printSnapshot(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Query("lang") lang?: string,
  ) {
    return this.invoices.getPrintSnapshot(orgId, id, lang);
  }

  @Get(":id/print-html")
  @ApiOperation({
    summary: "W3 vendor HTML for commercial invoice (from print snapshot)",
  })
  async printHtml(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Query("lang") lang?: string,
  ) {
    const html = await this.invoices.getPrintHtml(orgId, id, lang);
    return { html };
  }

  @Get(":id/portal-link")
  @ApiOperation({
    summary:
      "Публичная ссылка на портал счёта для клиента (без логина); создаёт token при первом запросе",
  })
  portalLink(@OrganizationId() orgId: string, @Param("id") id: string) {
    return this.invoices.ensurePortalShareLink(orgId, id);
  }

  @Get(":id/prefill")
  @ApiOperation({ summary: "DTO for extension e-qaimə prefill" })
  getPrefill(@OrganizationId() orgId: string, @Param("id") id: string) {
    return this.invoices.getExtensionPrefill(orgId, id);
  }

  @Post("bulk-prefill")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Permissions(CP_PERMISSION.API_INVOICES_UPDATE)
  @ApiOperation({ summary: "Bulk DTO list for extension e-qaimə prefill" })
  getBulkPrefill(@OrganizationId() orgId: string, @Body() dto: BulkPrefillInvoicesDto) {
    return this.invoices.getExtensionPrefillBulk(orgId, dto.invoiceIds);
  }

  @Post("bulk-sync-result")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Permissions(CP_PERMISSION.API_INVOICES_UPDATE)
  @ApiOperation({ summary: "Persist bulk sync results for invoices (DVX)" })
  saveBulkSyncResult(
    @OrganizationId() orgId: string,
    @Body() dto: BulkSyncResultInvoicesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.saveBulkSyncResult(orgId, dto, user.userId);
  }

  @Get(":id/eqaime/status")
  @Permissions(CP_PERMISSION.API_INVOICES_UPDATE)
  @ApiOperation({ summary: "e-Qaimə S2S status for sales invoice" })
  eqaimeStatus(@OrganizationId() orgId: string, @Param("id") id: string) {
    return this.eqaime.getStatus(orgId, id);
  }

  @Post(":id/eqaime/submit")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Permissions(CP_PERMISSION.API_INVOICES_UPDATE)
  @ApiOperation({
    summary:
      "Submit sales invoice to DVX e-Qaimə S2S (ERA_EQAIME_S2S_ENABLED=1; 503 when disabled)",
  })
  submitEqaime(@OrganizationId() orgId: string, @Param("id") id: string) {
    return this.eqaime.submit(orgId, id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Инвойс с позициями" })
  getOne(@OrganizationId() orgId: string, @Param("id") id: string) {
    return this.invoices.getOne(orgId, id);
  }

  @Post()
  @UseGuards(QuotaGuard)
  @Permissions(CP_PERMISSION.API_INVOICES_UPDATE)
  @CheckQuota(QuotaResource.INVOICES_PER_MONTH)
  @ApiOperation({ summary: "Создать инвойс (DRAFT), поставить PDF в очередь" })
  create(@OrganizationId() orgId: string, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(orgId, dto);
  }

  @Patch(":id")
  @UseGuards(SubscriptionGuard)
  @RequiresModule(ModuleEntitlement.TRADE_PRO)
  @Permissions(CP_PERMISSION.API_INVOICES_UPDATE)
  @ApiOperation({ summary: "Update trade context / Incoterms / export fields (trade_pro)" })
  patch(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Body() dto: PatchInvoiceDto,
  ) {
    return this.invoices.patch(orgId, id, dto);
  }

  @Patch(":id/status")
  @Permissions(CP_PERMISSION.API_INVOICES_UPDATE)
  @ApiOperation({
    summary:
      "SENT: Дт 211 Кт 601 (+ склад). PAID: оплата остатка целиком (части — POST …/payments). Статус PARTIALLY_PAID только через платежи.",
  })
  updateStatus(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateInvoiceStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.updateStatus(orgId, id, dto.status, requireOrgPolicySubject(user));
  }

  @Post(":id/send-email")
  @Permissions(CP_PERMISSION.API_INVOICES_UPDATE)
  @ApiOperation({ summary: "Отправить PDF инвойса на email контрагента (counterparty.email)" })
  sendEmail(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.sendInvoiceEmail(orgId, id, requireOrgPolicySubject(user));
  }
}
