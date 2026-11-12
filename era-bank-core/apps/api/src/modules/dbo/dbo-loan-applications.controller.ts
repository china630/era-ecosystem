import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { LoansDeepService } from "../loans/loans-deep.service";
import { BankCustomerAuthGuard, type BankCustomerRequest } from "./bank-customer-auth.guard";

class CreateLoanApplicationDto {
  @IsString()
  productTemplateId!: string;

  @IsNumber()
  requestedMinor!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

@ApiTags("dbo-loan-applications")
@ApiBearerAuth("service-token")
@UseGuards(BankAuthGuard, BankingModuleGuard, BankCustomerAuthGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo/loans/applications")
export class DboLoanApplicationsController {
  constructor(
    private readonly deep: LoansDeepService,
  ) {}

  @Get()
  list(@Req() req: BankCustomerRequest) {
    return this.deep.listApplicationsForCustomer(req.customerAuth.sub);
  }

  @Post()
  create(@Req() req: BankCustomerRequest, @Body() dto: CreateLoanApplicationDto) {
    return this.deep.createApplication({
      customerId: req.customerAuth.sub,
      productTemplateId: dto.productTemplateId,
      requestedMinor: BigInt(dto.requestedMinor),
      currency: dto.currency,
      makerUserId: `dbo:${req.customerAuth.sub}`,
    });
  }

  @Get(":id")
  async detail(@Req() req: BankCustomerRequest, @Param("id") id: string) {
    const app = await this.deep.findApplicationForCustomer(id, req.customerAuth.sub);
    if (!app) throw new NotFoundException("Loan application not found");
    return app;
  }

  @Post(":id/submit")
  async submit(@Req() req: BankCustomerRequest, @Param("id") id: string) {
    const app = await this.deep.findApplicationForCustomer(id, req.customerAuth.sub);
    if (!app) throw new NotFoundException("Loan application not found");
    if (app.customerId !== req.customerAuth.sub) {
      throw new ForbiddenException("Not in customer scope");
    }
    await this.deep.submitApplication(id);
    return this.deep.findApplicationById(id);
  }
}
