import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { parseLedgerTypeQuery } from "../common/ledger-type.util";
import { OrchestratorHoldingsClientService } from "../orchestrator/orchestrator-holdings-client.service";
import { HoldingsReportingService } from "./holdings-reporting.service";

@ApiTags("holdings")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("holdings")
export class HoldingsController {
  constructor(
    private readonly holdingsCp: OrchestratorHoldingsClientService,
    private readonly holdingsReporting: HoldingsReportingService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "List holdings from control plane (owner or report-access member)",
  })
  async findAll(@CurrentUser() user: AuthUser) {
    return this.holdingsCp.listHoldingsForUser(user.userId);
  }

  @Get(":id/consolidated-pnl")
  @ApiOperation({
    summary:
      "Сводный отчёт по прибыли/убытку (P&L) по всем организациям холдинга",
  })
  async consolidatedPnl(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("dateFrom") dateFrom: string,
    @Query("dateTo") dateTo: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    return this.holdingsReporting.consolidatedProfitAndLoss(
      user.userId,
      id,
      dateFrom,
      dateTo,
      parseLedgerTypeQuery(ledgerType),
    );
  }

  @Get(":id/summary")
  @ApiOperation({
    summary:
      "Сводка холдинга для dashboard: cash/bank (101+221) по организациям и в базовой валюте",
  })
  async summary(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("asOf") asOf?: string,
    @Query("ledgerType") ledgerType?: string,
  ) {
    return this.holdingsReporting.getHoldingSummary(user.userId, id, {
      asOf,
      ledgerType: parseLedgerTypeQuery(ledgerType),
    });
  }

  @Get(":id/balances-summary")
  @ApiOperation({
    summary:
      "Holding cash & bank balances summary (bank sync data consolidated to holding base currency)",
  })
  async balancesSummary(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.holdingsReporting.getHoldingBalancesSummaryForUser(
      user.userId,
      id,
    );
  }

  @Get(":id/tax-risk-monitor")
  @ApiOperation({
    summary:
      "Holding tax risk monitor: counterparties marked as risky taxpayers from e-taxes lookup",
  })
  async taxRiskMonitor(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.holdingsReporting.getHoldingTaxRiskMonitor(user.userId, id);
  }

  @Post(":id/sync-bank-balances")
  @ApiOperation({
    summary:
      "Force enqueue bank balances sync for all organizations in holding (BullMQ)",
  })
  async forceSyncBankBalances(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    return this.holdingsReporting.triggerManualBankSync(user.userId, id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Holding detail from control plane" })
  async findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.holdingsCp.getHoldingForUser(user.userId, id);
  }
}
