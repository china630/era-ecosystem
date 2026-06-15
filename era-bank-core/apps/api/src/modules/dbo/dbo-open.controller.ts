import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { BankingModuleGuard, RequireBankingModule } from "../../auth/banking-module.guard";
import { BankOrgConfig } from "../../common/bank-org.config";
import { PrismaService } from "../../prisma/prisma.service";
import { signCustomerJwt, verifyCustomerJwt } from "./dbo-crypto.util";
import { DboOpenApiService } from "./dbo-open-api.service";
import { DboPaymentsService } from "./dbo-payments.service";
import { OpenApiGuard, type OpenApiRequest } from "./open-api.guard";

class OpenPaymentDto {
  @IsString()
  debitAccountId!: string;

  @IsString()
  beneficiaryIban!: string;

  @IsString()
  beneficiaryName!: string;

  @IsNumber()
  amountMinor!: number;

  @IsOptional()
  @IsString()
  purpose?: string;
}

@ApiTags("dbo-open")
@UseGuards(BankAuthGuard, BankingModuleGuard, OpenApiGuard)
@RequireBankingModule("banking_dbo")
@Controller("dbo/open/payments/orders")
export class DboOpenController {
  constructor(
    private readonly openApi: DboOpenApiService,
    private readonly payments: DboPaymentsService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  private async authFromKey(req: OpenApiRequest) {
    const key = req.openApiKey!;
    const accounts = await this.prisma.account.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: key.customerId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    const secret = this.config.get<string>("BANK_DBO_JWT_SECRET") ?? "";
    const customerJwt = signCustomerJwt(
      {
        sub: key.customerId,
        channel: "CORPORATE",
        accountIds: accounts.map((a) => a.id),
      },
      secret,
    );
    const payload = verifyCustomerJwt(customerJwt, secret);
    if (!payload) throw new Error("Failed to mint customer JWT");
    return payload;
  }

  @Post()
  async create(
    @Req() req: OpenApiRequest,
    @Body() dto: OpenPaymentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    this.openApi.assertPermission(req.openApiKey!, "payments:create");
    const auth = await this.authFromKey(req);
    const order = await this.payments.createOrder(auth, {
      debitAccountId: dto.debitAccountId,
      beneficiaryIban: dto.beneficiaryIban,
      beneficiaryName: dto.beneficiaryName,
      purpose: dto.purpose,
      amountMinor: BigInt(dto.amountMinor),
      idempotencyKey: idempotencyKey ?? `open-${Date.now()}`,
    });
    const signed = await this.payments.signOrder(auth, order.id);
    return signed;
  }

  @Get(":id")
  async detail(@Req() req: OpenApiRequest, @Param("id") id: string) {
    this.openApi.assertPermission(req.openApiKey!, "payments:read");
    const auth = await this.authFromKey(req);
    return this.payments.getOrder(auth, id);
  }

  @Post(":id/submit")
  async submit(@Req() req: OpenApiRequest, @Param("id") id: string) {
    this.openApi.assertPermission(req.openApiKey!, "payments:submit");
    const auth = await this.authFromKey(req);
    return this.payments.submitOrder(auth, id);
  }
}
