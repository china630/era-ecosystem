import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { StandingOrderStatus } from "@era/bank-core-database";
import { IsDateString, IsOptional, IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { StandingOrdersService } from "./standing-orders.service";
import {
  ChequesService,
  NostroStatementImportService,
  SweepService,
  VirtualAccountsService,
} from "./cash-payments.service";

class StandingOrderDto {
  @IsString()
  customerId!: string;

  @IsString()
  fromAccountId!: string;

  @IsString()
  toIban!: string;

  @IsString()
  amountMinor!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  cronExpr?: string;

  @IsDateString()
  nextRunAt!: string;

  @IsString()
  idempotencyKey!: string;
}

class VirtualAccountDto {
  @IsString()
  customerId!: string;

  @IsString()
  parentAccountId!: string;

  @IsString()
  virtualIban!: string;
}

class ChequeDto {
  @IsString()
  accountId!: string;

  @IsString()
  chequeNumber!: string;

  @IsString()
  amountMinor!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  payeeName!: string;
}

class SweepDto {
  @IsString()
  masterAccountId!: string;

  @IsString()
  childAccountId!: string;

  @IsOptional()
  @IsString()
  targetMinor?: string;
}

class NostroImportDto {
  @IsString()
  payload!: string;
}

class RunDueDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;
}

@ApiTags("payments")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("payments")
export class CashPaymentsController {
  constructor(
    private readonly standingOrders: StandingOrdersService,
    private readonly virtualAccounts: VirtualAccountsService,
    private readonly cheques: ChequesService,
    private readonly sweep: SweepService,
    private readonly nostroStatementImport: NostroStatementImportService,
  ) {}

  @Get("standing-orders")
  listStandingOrders(@Query("status") status?: StandingOrderStatus) {
    return this.standingOrders.list(status);
  }

  @Post("standing-orders")
  createStandingOrder(@Body() dto: StandingOrderDto) {
    return this.standingOrders.create({
      ...dto,
      amountMinor: BigInt(dto.amountMinor),
      nextRunAt: new Date(dto.nextRunAt),
    });
  }

  @Post("standing-orders/run-due")
  runDue(@Body() dto: RunDueDto, @Req() req: BankAuthRequest) {
    const asOf = dto.asOf ? new Date(dto.asOf) : new Date();
    return this.standingOrders.runDue(asOf, req.userId ?? "service");
  }

  @Post("standing-orders/:id/pause")
  pauseStandingOrder(@Param("id") id: string) {
    return this.standingOrders.pause(id);
  }

  @Get("virtual-accounts")
  listVirtualAccounts(@Query("customerId") customerId?: string) {
    return this.virtualAccounts.list(customerId);
  }

  @Post("virtual-accounts")
  createVirtualAccount(@Body() dto: VirtualAccountDto) {
    return this.virtualAccounts.create(dto);
  }

  @Post("virtual-accounts/:id/close")
  closeVirtualAccount(@Param("id") id: string) {
    return this.virtualAccounts.close(id);
  }

  @Get("cheques")
  listCheques(@Query("accountId") accountId?: string) {
    return this.cheques.list(accountId);
  }

  @Post("cheques")
  issueCheque(@Body() dto: ChequeDto) {
    return this.cheques.issue({
      ...dto,
      amountMinor: BigInt(dto.amountMinor),
    });
  }

  @Post("cheques/:id/clear")
  clearCheque(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.cheques.clear(id, req.userId ?? "service");
  }

  @Post("cheques/:id/bounce")
  bounceCheque(@Param("id") id: string, @Req() req: BankAuthRequest) {
    return this.cheques.bounce(id, req.userId ?? "service");
  }

  @Get("sweep-rules")
  listSweepRules() {
    return this.sweep.list();
  }

  @Post("sweep-rules")
  createSweepRule(@Body() dto: SweepDto) {
    return this.sweep.create({
      masterAccountId: dto.masterAccountId,
      childAccountId: dto.childAccountId,
      targetMinor: dto.targetMinor ? BigInt(dto.targetMinor) : undefined,
    });
  }

  @Post("sweep-rules/:id/pause")
  pauseSweepRule(@Param("id") id: string) {
    return this.sweep.pause(id);
  }

  @Post("nostro-statement-import")
  importNostroStatement(@Body() dto: NostroImportDto) {
    return this.nostroStatementImport.importStub(dto.payload);
  }
}
