import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { TradeService } from "./trade.service";

class CreateLcDto {
  @IsString() customerId!: string;
  @IsString() reference!: string;
  @IsString() amountMinor!: string;
  @IsOptional() @IsString() direction?: string;
  @IsOptional() @IsString() beneficiaryName?: string;
}
class IssueDto {
  @IsString() branchId!: string;
  @IsString() idempotencyKey!: string;
}
class AmendDto {
  @IsString() note!: string;
}
class CreateBgDto {
  @IsString() customerId!: string;
  @IsString() reference!: string;
  @IsString() amountMinor!: string;
  @IsOptional() @IsString() kind?: string;
}
class CreateDcDto {
  @IsString() customerId!: string;
  @IsString() reference!: string;
  @IsString() amountMinor!: string;
}
class CreateScfDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() anchorBuyerId?: string;
}
class SwiftDto {
  @IsString() mtType!: string;
  @IsString() body!: string;
  @IsOptional() @IsString() relatedRef?: string;
}

@ApiTags("trade")
@ApiBearerAuth()
@UseGuards(BankAuthGuard)
@Controller("trade")
export class TradeController {
  constructor(private readonly trade: TradeService) {}

  @Get("lc")
  listLc() {
    return this.trade.listLc();
  }

  @Post("lc")
  createLc(@Body() body: CreateLcDto) {
    return this.trade.createLc(body);
  }

  @Post("lc/:id/issue")
  issueLc(@Req() req: BankAuthRequest, @Param("id") id: string, @Body() body: IssueDto) {
    return this.trade.issueLc({
      id,
      ...body,
      makerUserId: req.userId ?? "service",
    });
  }

  @Post("lc/:id/amend")
  amendLc(@Param("id") id: string, @Body() body: AmendDto) {
    return this.trade.amendLc(id, body.note);
  }

  @Get("guarantees")
  listBg() {
    return this.trade.listGuarantees();
  }

  @Post("guarantees")
  createBg(@Body() body: CreateBgDto) {
    return this.trade.createGuarantee(body);
  }

  @Post("guarantees/:id/issue")
  issueBg(@Req() req: BankAuthRequest, @Param("id") id: string, @Body() body: IssueDto) {
    return this.trade.issueGuarantee({
      id,
      ...body,
      makerUserId: req.userId ?? "service",
    });
  }

  @Get("dc")
  listDc() {
    return this.trade.listDc();
  }

  @Post("dc")
  createDc(@Body() body: CreateDcDto) {
    return this.trade.createDc(body);
  }

  @Get("scf")
  listScf() {
    return this.trade.listScf();
  }

  @Post("scf")
  createScf(@Body() body: CreateScfDto) {
    return this.trade.createScf(body);
  }

  @Post("scf/:id/activate")
  activateScf(@Param("id") id: string) {
    return this.trade.activateScf(id);
  }

  @Post("scf/:id/fund")
  fundScf(@Param("id") id: string, @Body() body: { amountMinor: string }) {
    return this.trade.fundScf(id, BigInt(body.amountMinor));
  }

  @Post("packing-credit")
  packingCredit(
    @Body()
    body: {
      customerId: string;
      tradeRef: string;
      lcId: string;
      amountMinor: string;
    },
  ) {
    return this.trade.registerPackingCredit({
      ...body,
      amountMinor: BigInt(body.amountMinor),
    });
  }

  @Get("swift/types")
  swiftTypes() {
    return this.trade.swiftMessageTypes();
  }

  @Post("swift")
  queueSwift(@Body() body: SwiftDto) {
    return this.trade.queueSwift(body);
  }

  @Post("swift/:id/submit")
  submitSwift(@Param("id") id: string) {
    return this.trade.submitSwift(id);
  }
}
