import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CustomerType } from "@era/bank-core-database";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { CifService } from "./cif.service";

class CreateCustomerDto {
  @IsOptional()
  @IsString()
  globalPersonId?: string;

  @IsOptional()
  @IsString()
  fin?: string;

  @IsOptional()
  @IsString()
  voen?: string;

  @IsEnum(CustomerType)
  customerType!: CustomerType;

  @IsString()
  homeBranchId!: string;
}

@ApiTags("cif")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard)
@Controller("cif/customers")
export class CifController {
  constructor(private readonly cif: CifService) {}

  @Get()
  list(@Query("q") q?: string, @Query("status") status?: string) {
    return this.cif.list({ q, status });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.cif.getById(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto, @Req() req: BankAuthRequest) {
    return this.cif.create({
      ...dto,
      actorUserId: req.userId ?? "service",
    });
  }

  @Post(":id/beneficial-owners")
  addBeneficialOwner(
    @Param("id") id: string,
    @Body()
    dto: {
      fin?: string;
      passport?: string;
      issuingCountry?: string;
      fullName?: string;
      sharePercent: number;
    },
    @Req() req: BankAuthRequest,
  ) {
    return this.cif.addBeneficialOwner({
      customerId: id,
      ...dto,
      actorUserId: req.userId ?? "service",
    });
  }

  @Patch(":id/pep-flag")
  updatePepFlag(
    @Param("id") id: string,
    @Body() dto: { pepFlag: boolean },
    @Req() req: BankAuthRequest,
  ) {
    return this.cif.updatePepFlag(id, dto.pepFlag, req.userId ?? "service");
  }
}
