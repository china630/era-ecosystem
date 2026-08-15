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
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { FeeService } from "./fee.service";

class CreateTariffDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsString() amountMinor!: string;
  @IsOptional() @IsString() currency?: string;
}
class AssessFeeDto {
  @IsString() tariffCode!: string;
  @IsString() branchId!: string;
  @IsOptional() @IsString() debitAccountId?: string;
  @IsOptional() @IsString() amountMinor?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsString() idempotencyKey!: string;
}
class CreatePackageDto {
  @IsString() code!: string;
  @IsString() name!: string;
}
class LinkPackageDto {
  @IsString() customerId!: string;
}
class LinkPackageTariffDto {
  @IsString() tariffCode!: string;
  @IsString() waiverType!: string;
  @IsOptional() @IsString() waiverValue?: string;
}
class CreateSdbDto {
  @IsString() branchId!: string;
  @IsString() boxNumber!: string;
  @IsOptional() @IsString() rentMinor?: string;
}
class RentSdbDto {
  @IsString() customerId!: string;
}

@ApiTags("fees")
@ApiBearerAuth()
@UseGuards(BankAuthGuard)
@Controller()
export class FeeController {
  constructor(private readonly fees: FeeService) {}

  @Get("fees/tariffs")
  listTariffs(@Query("status") status?: string) {
    return this.fees.listTariffs(status as never);
  }

  @Post("fees/tariffs")
  createTariff(@Body() body: CreateTariffDto) {
    return this.fees.createTariff(body);
  }

  @Post("fees/assess")
  assess(@Req() req: BankAuthRequest, @Body() body: AssessFeeDto) {
    return this.fees.assessAndPost({
      ...body,
      makerUserId: req.userId ?? "service",
    });
  }

  @Get("fees/packages")
  listPackages() {
    return this.fees.listPackages();
  }

  @Post("fees/packages")
  createPackage(@Body() body: CreatePackageDto) {
    return this.fees.createPackage(body);
  }

  @Post("fees/packages/:id/links")
  linkPackage(@Param("id") id: string, @Body() body: LinkPackageDto) {
    return this.fees.linkPackage(id, body.customerId);
  }

  @Get("fees/packages/:id/tariffs")
  listPackageTariffs(@Param("id") id: string) {
    return this.fees.listPackageTariffs(id);
  }

  @Post("fees/packages/:id/tariffs")
  linkPackageTariff(@Param("id") id: string, @Body() body: LinkPackageTariffDto) {
    return this.fees.linkPackageTariff({ packageId: id, ...body });
  }

  @Get("fees/safe-deposit-boxes")
  listSdb(@Query("branchId") branchId?: string) {
    return this.fees.listSafeBoxes(branchId);
  }

  @Post("fees/safe-deposit-boxes")
  createSdb(@Body() body: CreateSdbDto) {
    return this.fees.createSafeBox(body);
  }

  @Post("fees/safe-deposit-boxes/:id/rent")
  rentSdb(@Param("id") id: string, @Body() body: RentSdbDto) {
    return this.fees.rentSafeBox(id, body.customerId);
  }
}
