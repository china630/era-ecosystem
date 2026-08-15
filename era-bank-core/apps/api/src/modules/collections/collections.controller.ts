import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { CollectionsService } from "./collections.service";

class CreateCaseDto {
  @IsString() loanId!: string;
  @IsString() customerId!: string;
  @IsString() outstandingMinor!: string;
}
class AssignDto {
  @IsString() assigneeUserId!: string;
}
class PtpDto {
  @IsString() amountMinor!: string;
  @IsString() dueDate!: string;
}
class RecoverDto {
  @IsString() amountMinor!: string;
  @IsString() branchId!: string;
  @IsString() checkerUserId!: string;
  @IsString() idempotencyKey!: string;
}

@ApiTags("collections")
@ApiBearerAuth()
@UseGuards(BankAuthGuard)
@Controller("collections")
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get("cases")
  list(@Query("status") status?: string) {
    return this.collections.listCases(status as never);
  }

  @Post("cases")
  create(@Body() body: CreateCaseDto) {
    return this.collections.createCase(body);
  }

  @Post("cases/:id/assign")
  assign(@Param("id") id: string, @Body() body: AssignDto) {
    return this.collections.assign(id, body.assigneeUserId);
  }

  @Post("cases/:id/ptp")
  ptp(@Param("id") id: string, @Body() body: PtpDto) {
    return this.collections.addPtp(id, body.amountMinor, body.dueDate);
  }

  @Post("cases/:id/recover")
  recover(
    @Req() req: BankAuthRequest,
    @Param("id") id: string,
    @Body() body: RecoverDto,
  ) {
    return this.collections.recover({
      id,
      ...body,
      makerUserId: req.userId ?? "service",
    });
  }

  @Post("cases/:id/write-off")
  writeOff(
    @Req() req: BankAuthRequest,
    @Param("id") id: string,
    @Body() body: { checkerUserId: string },
  ) {
    return this.collections.writeOff({
      id,
      makerUserId: req.userId ?? "service",
      checkerUserId: body.checkerUserId,
    });
  }
}
