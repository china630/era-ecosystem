import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { requireOrgRole } from "../auth/require-org-role";
import type { AuthUser } from "../auth/types/auth-user";
import { RolesGuard } from "../auth/guards/roles.guard";
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
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
      actingUserRole: requireOrgRole(user),
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Проверка готовности к закрытию месяца: draft invoices, negative stock/cash, depreciation",
  })
  periodCloseChecklist(
    @OrganizationId() organizationId: string,
    @Query("month") month: string,
  ) {
    return this.accounting.getPeriodCloseChecklist(organizationId, month);
  }
}
