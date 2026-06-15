import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsDateString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { EodService } from "./eod.service";

class RunEodDto {
  @IsDateString()
  businessDate!: string;
}

@ApiTags("eod")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("eod")
export class EodController {
  constructor(private readonly eod: EodService) {}

  @Post("run")
  run(@Body() dto: RunEodDto) {
    return this.eod.run(new Date(dto.businessDate));
  }

  @Get(":date")
  get(@Param("date") date: string) {
    return this.eod.getByDate(new Date(date));
  }
}
