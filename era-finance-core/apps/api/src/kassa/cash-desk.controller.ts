import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { AdvanceReportStatus, UserRole } from "@erafinance/database";
import { Response } from "express";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { parseLedgerTypeQuery } from "../common/ledger-type.util";
import { CashOrderService } from "./cash-order.service";
import { AdvanceReportService } from "./advance-report.service";
import {
  CreateAdvanceReportDto,
  UpdateAdvanceReportDto,
} from "./dto/advance-report.dto";
import { CreatePkoDraftDto } from "./dto/create-pko.dto";
import { CreateRkoDraftDto } from "./dto/create-rko.dto";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";

@ApiTags("banking-cash")
@ApiBearerAuth("bearer")
@UseGuards(SubscriptionGuard)
@RequiresModule(ModuleEntitlement.KASSA_PRO)
@Controller("banking/cash")
export class CashDeskController {
  constructor(
    private readonly cash: CashOrderService,
    private readonly advanceReports: AdvanceReportService,
  ) {}

  @Get("balances")
  @ApiOperation({ summary: "Остаток кассы (101*) по валютам" })
  balances(
    @OrganizationId() organizationId: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    const lt = parseLedgerTypeQuery(ledgerType);
    return this.cash.getCashBalancesByCurrency(organizationId, lt);
  }

  @Get("orders")
  @ApiOperation({
    summary: "Журнал кассовых ордеров (KMO/KXO — Kassa Mədaxil/Məxaric Orderi)",
  })
  orders(
    @OrganizationId() organizationId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("page") pageStr?: string,
    @Query("pageSize") pageSizeStr?: string,
  ) {
    const from = dateFrom?.trim();
    const to = dateTo?.trim();
    const valid =
      from &&
      to &&
      /^\d{4}-\d{2}-\d{2}$/.test(from) &&
      /^\d{4}-\d{2}-\d{2}$/.test(to);
    const page = Math.max(1, Math.trunc(Number(pageStr) || 1));
    const pageSizeRaw = Math.trunc(Number(pageSizeStr) || 25);
    const pageSize = Math.min(200, Math.max(1, pageSizeRaw));
    return this.cash.listOrders(
      organizationId,
      valid
        ? { dateFrom: from, dateTo: to, page, pageSize }
        : { page, pageSize },
    );
  }

  @Post("orders/kmo")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Создать черновик KMO (приход, CashOrderKind.KMO)" })
  createKmo(
    @OrganizationId() organizationId: string,
    @Body() dto: CreatePkoDraftDto,
  ) {
    return this.cash.createDraftPko(organizationId, dto);
  }

  @Post("orders/kxo")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Создать черновик KXO (расход, CashOrderKind.KXO)" })
  createKxo(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateRkoDraftDto,
  ) {
    return this.cash.createDraftRko(organizationId, dto);
  }

  /** Backward-compatible aliases (will be removed later). */
  @Post("orders/mko")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "[DEPRECATED] Alias for /orders/kmo" })
  createMkoAlias(
    @OrganizationId() organizationId: string,
    @Body() dto: CreatePkoDraftDto,
  ) {
    return this.cash.createDraftPko(organizationId, dto);
  }

  /** Backward-compatible aliases (will be removed later). */
  @Post("orders/mxo")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "[DEPRECATED] Alias for /orders/kxo" })
  createMxoAlias(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateRkoDraftDto,
  ) {
    return this.cash.createDraftRko(organizationId, dto);
  }

  /** Backward-compatible aliases (will be removed later). */
  @Post("orders/pko")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "[DEPRECATED] Alias for /orders/kmo" })
  createPkoAlias(
    @OrganizationId() organizationId: string,
    @Body() dto: CreatePkoDraftDto,
  ) {
    return this.cash.createDraftPko(organizationId, dto);
  }

  /** Backward-compatible aliases (will be removed later). */
  @Post("orders/rko")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "[DEPRECATED] Alias for /orders/kxo" })
  createRkoAlias(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateRkoDraftDto,
  ) {
    return this.cash.createDraftRko(organizationId, dto);
  }

  @Post("orders/:id/post")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Провести черновик ордера" })
  postOrder(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.cash.postOrder(organizationId, id);
  }

  @Get("orders/:id/print")
  @ApiOperation({ summary: "HTML бланк ордера для печати" })
  @Header("Content-Type", "text/html; charset=utf-8")
  async printOrder(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const html = await this.cash.getPrintHtml(organizationId, id);
    res.send(html);
  }

  @Get("accountable")
  @ApiOperation({ summary: "Подотчётные лица (дебет 244)" })
  accountable(
    @OrganizationId() organizationId: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    const lt = parseLedgerTypeQuery(ledgerType);
    return this.cash.listAccountablePersons(organizationId, lt);
  }

  @Get("advance-reports")
  @ApiOperation({ summary: "Registry of advance reports (avans hesabatı)" })
  listAdvanceReports(
    @OrganizationId() organizationId: string,
    @Query("status") status?: string,
    @Query("employeeId") employeeId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("page") pageStr?: string,
    @Query("pageSize") pageSizeStr?: string,
  ) {
    const statusFilter =
      status === AdvanceReportStatus.DRAFT || status === AdvanceReportStatus.POSTED
        ? status
        : undefined;
    return this.advanceReports.list(organizationId, {
      status: statusFilter,
      employeeId: employeeId?.trim() || undefined,
      dateFrom: dateFrom?.trim() || undefined,
      dateTo: dateTo?.trim() || undefined,
      page: Math.trunc(Number(pageStr) || 1),
      pageSize: Math.trunc(Number(pageSizeStr) || 25),
    });
  }

  @Get("advance-reports/:id")
  @ApiOperation({ summary: "Advance report detail with lines" })
  getAdvanceReport(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.advanceReports.getOne(organizationId, id);
  }

  @Get("advance-reports/:id/print")
  @ApiOperation({ summary: "Printable HTML for advance report" })
  @Header("Content-Type", "text/html; charset=utf-8")
  async printAdvanceReport(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const html = await this.advanceReports.getPrintHtml(organizationId, id);
    res.send(html);
  }

  @Post("advance-reports")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create draft advance report" })
  createAdvance(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateAdvanceReportDto,
  ) {
    return this.advanceReports.createDraft(organizationId, dto);
  }

  @Patch("advance-reports/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Update draft advance report" })
  updateAdvance(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAdvanceReportDto,
  ) {
    return this.advanceReports.updateDraft(organizationId, id, dto);
  }

  @Post("advance-reports/:id/post")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Post advance report to GL (Dr expense / Cr 244)" })
  postAdvance(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.advanceReports.post(organizationId, id);
  }
}
