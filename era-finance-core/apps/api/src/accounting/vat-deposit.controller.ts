import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { VoenIntegrityGuard } from "../auth/guards/voen-integrity.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { parseIsoDateOnly } from "../reporting/reporting-period.util";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { PrismaService } from "../prisma/prisma.service";
import {
  ReconcileVatDepositDto,
  RemitVatDepositDto,
  RouteVatDepositDto,
} from "./dto/vat-deposit.dto";
import { VatDepositService } from "./vat-deposit.service";

@ApiTags("accounting")
@ApiBearerAuth("bearer")
@Controller("accounting/vat-deposit")
@UseGuards(PermissionsGuard)
export class VatDepositController {
  constructor(
    private readonly vatDeposit: VatDepositService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("balance")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "ƏDV depozit GL balance and linked bank account" })
  balance(@OrganizationId() organizationId: string) {
    return this.vatDeposit.getBalance(organizationId);
  }

  @Get("movements")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "ƏDV depozit ledger movements" })
  movements(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.vatDeposit.listMovements(organizationId, { dateFrom, dateTo });
  }

  @Post("route")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary:
      "Route incoming VAT portion from main bank to ƏDV deposit (Dr deposit / Cr bank)",
  })
  async route(
    @OrganizationId() organizationId: string,
    @Body() dto: RouteVatDepositDto,
  ) {
    const payDate = dto.paymentDate?.trim()
      ? parseIsoDateOnly(dto.paymentDate)
      : new Date();
    return this.prisma.$transaction((tx) =>
      this.vatDeposit.routeIncomingVatPortion(tx, organizationId, {
        paymentAmount: dto.paymentAmount,
        vatPortion: dto.vatPortion,
        bankAccountId: dto.bankAccountId,
        counterpartyId: dto.counterpartyId,
        note: dto.note,
        paymentDate: payDate,
      }),
    );
  }

  @Post("remit")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "Remit VAT to treasury from deposit (Dr VAT output / Cr deposit)",
  })
  async remit(
    @OrganizationId() organizationId: string,
    @Body() dto: RemitVatDepositDto,
  ) {
    const payDate = dto.paymentDate?.trim()
      ? parseIsoDateOnly(dto.paymentDate)
      : new Date();
    return this.prisma.$transaction((tx) =>
      this.vatDeposit.payVatFromDeposit(tx, organizationId, {
        amount: dto.amount,
        bankAccountId: dto.bankAccountId,
        note: dto.note,
        paymentDate: payDate,
      }),
    );
  }

  @Post("reconcile")
  @UseGuards(SubscriptionGuard, VoenIntegrityGuard)
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "Best-effort reconcile GL deposit movements vs bank statement inflows",
  })
  reconcile(
    @OrganizationId() organizationId: string,
    @Body() dto: ReconcileVatDepositDto,
  ) {
    return this.vatDeposit.reconcile(organizationId, dto);
  }
}
