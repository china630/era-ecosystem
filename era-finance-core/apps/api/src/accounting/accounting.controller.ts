import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { LedgerType } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { requireOrgPolicySubject } from "../auth/policies/policy-subject";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { PostingAccountResolver } from "./posting/posting-account-resolver.service";
import { AccountingService } from "./accounting.service";
import { QuickExpenseDto } from "./dto/quick-expense.dto";

@ApiTags("accounting")
@ApiBearerAuth("bearer")
@Controller("accounting")
export class AccountingController {
  constructor(
    private readonly accounting: AccountingService,
    private readonly posting: PostingAccountResolver,
  ) {}

  @Post("quick-expense")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary:
      "Быстрая запись расхода: Дт 731 (прочие операционные) / Кт 101.01 (касса)",
  })
  async quickExpense(
    @OrganizationId() organizationId: string,
    @Body() dto: QuickExpenseDto,
    @CurrentUser() user: AuthUser,
  ) {
    const date = dto.date ? new Date(dto.date) : new Date();
    const ref = "WEB-EXP";
    const desc = dto.description?.trim() || "Операционный расход (веб)";
    const amt = String(dto.amount);
    const [miscExpenseCode, cashAznCode] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "MISC_OPERATING_EXPENSE"),
      this.posting.resolveAccountCode(organizationId, "CASH_AZN"),
    ]);
    const { transactionId } = await this.accounting.postTransaction({
      organizationId,
      date,
      reference: ref,
      description: desc,
      isFinal: true,
      actingUser: requireOrgPolicySubject(user),
      departmentId: dto.departmentId ?? null,
      lines: [
        {
          accountCode: miscExpenseCode,
          debit: amt,
          credit: 0,
        },
        {
          accountCode: cashAznCode,
          debit: 0,
          credit: amt,
        },
      ],
    });
    return { transactionId };
  }

  @Get("period-close/checklist")
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({
    summary:
      "Проверка готовности к закрытию месяца: draft invoices, negative stock/cash, depreciation (ledger-aware)",
  })
  periodCloseChecklist(
    @OrganizationId() organizationId: string,
    @Query("month") month: string,
    @Query("ledgerType") ledgerTypeRaw?: string,
  ) {
    const ledgerType =
      ledgerTypeRaw?.trim().toUpperCase() === "IFRS"
        ? LedgerType.IFRS
        : LedgerType.NAS;
    return this.accounting.getPeriodCloseChecklist(
      organizationId,
      month,
      ledgerType,
    );
  }
}
