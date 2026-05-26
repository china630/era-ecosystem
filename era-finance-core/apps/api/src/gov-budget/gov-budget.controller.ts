import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { CheckBudgetLimitDto } from "./dto/check-budget-limit.dto";
import { CreateBudgetYearDto } from "./dto/create-budget-year.dto";
import { RecordBudgetExpenseDto } from "./dto/record-budget-expense.dto";
import { RecordBudgetFundingDto } from "./dto/record-budget-funding.dto";
import { GovBudgetService } from "./gov-budget.service";

@ApiTags("gov-budget")
@ApiBearerAuth("bearer")
@Controller("gov-budget")
@UseGuards(SubscriptionGuard, RolesGuard)
@RequiresModule(ModuleEntitlement.GOV_BUDGET_PRO)
export class GovBudgetController {
  constructor(private readonly govBudget: GovBudgetService) {}

  @Get("years")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: "List budget years" })
  listYears(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
  ) {
    return this.govBudget.listYears(organizationId, { page, pageSize });
  }

  @Post("years")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Create budget year (DRAFT)" })
  createYear(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateBudgetYearDto,
  ) {
    return this.govBudget.createYear(organizationId, dto);
  }

  @Post("years/:id/approve")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Approve budget year" })
  approveYear(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.govBudget.approveYear(organizationId, id);
  }

  @Post("years/:id/amend")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: "Mark approved budget year as amended (editable cycle)" })
  amendYear(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.govBudget.amendYear(organizationId, id);
  }

  @Get("years/:id/lines")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: "List budget lines" })
  listLines(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.govBudget.listLines(organizationId, id);
  }

  @Post("funding")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary: "Record treasury funding (BUDGET_APPROPRIATION ledger posting)",
  })
  recordFunding(
    @OrganizationId() organizationId: string,
    @Body() dto: RecordBudgetFundingDto,
  ) {
    return this.govBudget.recordFundingReceipt(organizationId, dto);
  }

  @Post("expense-execution")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      "Execute budget expense against line (BUDGET_EXPENSE_EXECUTION + commitment)",
  })
  recordExpense(
    @OrganizationId() organizationId: string,
    @Body() dto: RecordBudgetExpenseDto,
  ) {
    return this.govBudget.recordExpenseExecution(organizationId, dto);
  }

  @Post("check-limit")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Check budget line limit" })
  checkLimit(
    @OrganizationId() organizationId: string,
    @Body() dto: CheckBudgetLimitDto,
  ) {
    return this.govBudget.checkLimit(organizationId, dto);
  }

  @Get("years/:id/execution")
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: "Plan vs fact execution snapshot (stub)" })
  execution(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.govBudget.execution(organizationId, id);
  }

  @Post("years/:id/import-esmeta")
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: "E-Smeta import stub (Phase 2) — accepts JSON lines, returns preview",
  })
  importEsmeta(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: { lines?: { accountCode: string; limitAnnual: number }[] },
  ) {
    return this.govBudget.importEsmetaStub(organizationId, id, body);
  }
}
