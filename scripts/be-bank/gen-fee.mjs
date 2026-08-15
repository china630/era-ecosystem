import fs from "fs";
import path from "path";

const root = "d:/My Projects/era-ecosystem/era-bank-core/apps/api/src";
const w = (rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", rel);
};

w(
  "modules/fee/fee.module.ts",
  `import { Module } from "@nestjs/common";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { FeeController } from "./fee.controller";
import { FeeService } from "./fee.service";

@Module({
  imports: [LedgerModule, PostingEngineModule],
  controllers: [FeeController],
  providers: [FeeService],
  exports: [FeeService],
})
export class FeeModule {}
`,
);

w(
  "modules/fee/fee.service.ts",
  `import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { FeeTariffStatus, TxnType } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { BankErrorCode } from "../../common/bank-error-codes";
import { assertIdempotencyKey } from "../../common/idempotency";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";

@Injectable()
export class FeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
  ) {}

  listTariffs(status?: FeeTariffStatus) {
    return this.prisma.feeTariff.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(status ? { status } : {}),
      },
      orderBy: { code: "asc" },
    });
  }

  createTariff(input: {
    code: string;
    name: string;
    amountMinor: string;
    currency?: string;
  }) {
    return this.prisma.feeTariff.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        code: input.code,
        name: input.name,
        amountMinor: BigInt(input.amountMinor),
        currency: input.currency ?? "AZN",
        status: FeeTariffStatus.ACTIVE,
      },
    });
  }

  listPackages() {
    return this.prisma.relationshipPackage.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      include: { links: true },
    });
  }

  createPackage(input: { code: string; name: string }) {
    return this.prisma.relationshipPackage.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        code: input.code,
        name: input.name,
      },
    });
  }

  linkPackage(packageId: string, customerId: string) {
    return this.prisma.relationshipPackageLink.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        packageId,
        customerId,
      },
    });
  }

  listSafeBoxes(branchId?: string) {
    return this.prisma.safeDepositBox.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(branchId ? { branchId } : {}),
      },
    });
  }

  createSafeBox(input: {
    branchId: string;
    boxNumber: string;
    rentMinor?: string;
  }) {
    return this.prisma.safeDepositBox.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        branchId: input.branchId,
        boxNumber: input.boxNumber,
        rentMinor: BigInt(input.rentMinor ?? "0"),
      },
    });
  }

  async rentSafeBox(id: string, customerId: string) {
    const box = await this.prisma.safeDepositBox.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!box) throw new NotFoundException("Safe deposit box not found");
    if (box.status !== "AVAILABLE") {
      throw new BadRequestException({
        code: BankErrorCode.INVALID_STATE,
        message: "Box not available",
      });
    }
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return this.prisma.safeDepositBox.update({
      where: { id },
      data: {
        customerId,
        status: "RENTED",
        rentedAt: new Date(),
        nextRentDate: next,
      },
    });
  }

  async assessAndPost(input: {
    tariffCode: string;
    branchId: string;
    debitAccountId?: string;
    amountMinor?: string;
    makerUserId: string;
    idempotencyKey: string;
  }) {
    const key = assertIdempotencyKey(input.idempotencyKey);
    const tariff = await this.prisma.feeTariff.findUnique({
      where: {
        bankOrgId_code: {
          bankOrgId: this.bankOrg.bankOrgId,
          code: input.tariffCode,
        },
      },
    });
    if (!tariff || tariff.status !== FeeTariffStatus.ACTIVE) {
      throw new NotFoundException({
        code: BankErrorCode.UNKNOWN_TARIFF,
        message: \`Unknown tariff \${input.tariffCode}\`,
      });
    }
    const amount = BigInt(input.amountMinor ?? tariff.amountMinor.toString());
    if (amount <= 0n) {
      throw new BadRequestException("amountMinor must be positive");
    }
    const feeIncome = await this.systemGl.resolve(SystemGlKey.FEE_INCOME);
    const cashVault = await this.systemGl.resolve(SystemGlKey.CASH_VAULT);
    const txn = await this.postingEngine.post({
      reference: \`FEE:\${tariff.code}\`,
      idempotencyKey: key,
      valueDate: new Date(),
      type: TxnType.FEE,
      makerUserId: input.makerUserId,
      branchId: input.branchId,
      autoApprove: true,
      legs: [
        {
          accountId: input.debitAccountId,
          glAccountId: cashVault.id,
          branchId: input.branchId,
          debitMinor: amount,
          creditMinor: 0n,
          currency: tariff.currency,
        },
        {
          glAccountId: feeIncome.id,
          branchId: input.branchId,
          debitMinor: 0n,
          creditMinor: amount,
          currency: tariff.currency,
        },
      ],
    });
    return { tariff, amountMinor: amount.toString(), journalTxnId: txn.id };
  }

  async sdbRentDueCount(asOf: Date) {
    return this.prisma.safeDepositBox.count({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: "RENTED",
        nextRentDate: { lte: asOf },
      },
    });
  }
}
`,
);

w(
  "modules/fee/fee.controller.ts",
  `import {
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
  @IsString() idempotencyKey!: string;
}
class CreatePackageDto {
  @IsString() code!: string;
  @IsString() name!: string;
}
class LinkPackageDto {
  @IsString() customerId!: string;
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
      makerUserId: req.user?.sub ?? "service",
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
`,
);

console.log("fee module ok");
