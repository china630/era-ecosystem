import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { IslamicService } from "./islamic.service";

class CreateDto {
  @IsString() customerId!: string;
  @IsString() productTemplateId!: string;
  @IsString() kind!: string;
  @IsString() principalMinor!: string;
}
class ActivateDto {
  @IsString() branchId!: string;
  @IsString() idempotencyKey!: string;
  @IsOptional() @IsString() profitMinor?: string;
}

@ApiTags("islamic")
@ApiBearerAuth()
@UseGuards(BankAuthGuard)
@Controller("islamic")
export class IslamicController {
  constructor(private readonly islamic: IslamicService) {}

  @Get("contracts")
  list() {
    return this.islamic.list();
  }

  @Post("contracts")
  create(@Body() body: CreateDto) {
    return this.islamic.create(body);
  }

  @Post("contracts/:id/activate")
  activate(
    @Req() req: BankAuthRequest,
    @Param("id") id: string,
    @Body() body: ActivateDto,
  ) {
    return this.islamic.activate({
      id,
      ...body,
      makerUserId: req.userId ?? "service",
    });
  }
}
