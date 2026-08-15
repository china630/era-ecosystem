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
  "modules/trade/trade.module.ts",
  `import { Module } from "@nestjs/common";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { TradeController } from "./trade.controller";
import { TradeService } from "./trade.service";

@Module({
  imports: [LedgerModule, PostingEngineModule],
  controllers: [TradeController],
  providers: [TradeService],
  exports: [TradeService],
})
export class TradeModule {}
`,
);

w(
  "modules/trade/trade.service.ts",
  `import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TradeInstrumentStatus, TxnType } from "@era/bank-core-database";
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
export class TradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
  ) {}

  listLc() {
    return this.prisma.letterOfCredit.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      include: { amendments: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  createLc(input: {
    customerId: string;
    reference: string;
    amountMinor: string;
    direction?: string;
    beneficiaryName?: string;
  }) {
    return this.prisma.letterOfCredit.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        reference: input.reference,
        amountMinor: BigInt(input.amountMinor),
        direction: input.direction ?? "IMPORT",
        beneficiaryName: input.beneficiaryName,
      },
    });
  }

  async issueLc(input: {
    id: string;
    branchId: string;
    makerUserId: string;
    idempotencyKey: string;
  }) {
    const key = assertIdempotencyKey(input.idempotencyKey);
    const lc = await this.prisma.letterOfCredit.findFirst({
      where: { id: input.id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!lc) throw new NotFoundException("LC not found");
    if (lc.status !== TradeInstrumentStatus.DRAFT) {
      throw new BadRequestException({
        code: BankErrorCode.INVALID_STATE,
        message: "LC not in DRAFT",
      });
    }
    const asset = await this.systemGl.resolve(SystemGlKey.TRADE_CONTINGENT_ASSET);
    const liab = await this.systemGl.resolve(
      SystemGlKey.TRADE_CONTINGENT_LIABILITY,
    );
    const amount = lc.amountMinor;
    const txn = await this.postingEngine.post({
      reference: \`LC-ISSUE:\${lc.reference}\`,
      idempotencyKey: key,
      valueDate: new Date(),
      type: TxnType.CONTINGENT,
      makerUserId: input.makerUserId,
      branchId: input.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: asset.id,
          branchId: input.branchId,
          debitMinor: amount,
          creditMinor: 0n,
          currency: lc.currency,
        },
        {
          glAccountId: liab.id,
          branchId: input.branchId,
          debitMinor: 0n,
          creditMinor: amount,
          currency: lc.currency,
        },
      ],
    });
    return this.prisma.letterOfCredit.update({
      where: { id: lc.id },
      data: {
        status: TradeInstrumentStatus.ISSUED,
        journalTxnId: txn.id,
      },
    });
  }

  async amendLc(id: string, note: string) {
    const lc = await this.prisma.letterOfCredit.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!lc) throw new NotFoundException("LC not found");
    const last = await this.prisma.tradeLcAmendment.findFirst({
      where: { lcId: id },
      orderBy: { seqNo: "desc" },
    });
    await this.prisma.tradeLcAmendment.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        lcId: id,
        seqNo: (last?.seqNo ?? 0) + 1,
        note,
      },
    });
    return this.prisma.letterOfCredit.update({
      where: { id },
      data: { status: TradeInstrumentStatus.AMENDED },
      include: { amendments: true },
    });
  }

  listGuarantees() {
    return this.prisma.bankGuarantee.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      take: 100,
    });
  }

  createGuarantee(input: {
    customerId: string;
    reference: string;
    amountMinor: string;
    kind?: string;
  }) {
    return this.prisma.bankGuarantee.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        reference: input.reference,
        amountMinor: BigInt(input.amountMinor),
        kind: input.kind ?? "BG",
      },
    });
  }

  async issueGuarantee(input: {
    id: string;
    branchId: string;
    makerUserId: string;
    idempotencyKey: string;
  }) {
    const key = assertIdempotencyKey(input.idempotencyKey);
    const bg = await this.prisma.bankGuarantee.findFirst({
      where: { id: input.id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!bg) throw new NotFoundException("Guarantee not found");
    const asset = await this.systemGl.resolve(SystemGlKey.TRADE_CONTINGENT_ASSET);
    const liab = await this.systemGl.resolve(
      SystemGlKey.TRADE_CONTINGENT_LIABILITY,
    );
    const txn = await this.postingEngine.post({
      reference: \`BG-ISSUE:\${bg.reference}\`,
      idempotencyKey: key,
      valueDate: new Date(),
      type: TxnType.CONTINGENT,
      makerUserId: input.makerUserId,
      branchId: input.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: asset.id,
          branchId: input.branchId,
          debitMinor: bg.amountMinor,
          creditMinor: 0n,
          currency: bg.currency,
        },
        {
          glAccountId: liab.id,
          branchId: input.branchId,
          debitMinor: 0n,
          creditMinor: bg.amountMinor,
          currency: bg.currency,
        },
      ],
    });
    return this.prisma.bankGuarantee.update({
      where: { id: bg.id },
      data: { status: TradeInstrumentStatus.ISSUED, journalTxnId: txn.id },
    });
  }

  listDc() {
    return this.prisma.documentaryCollection.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
    });
  }

  createDc(input: {
    customerId: string;
    reference: string;
    amountMinor: string;
  }) {
    return this.prisma.documentaryCollection.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        reference: input.reference,
        amountMinor: BigInt(input.amountMinor),
      },
    });
  }

  listScf() {
    return this.prisma.scfProgram.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
    });
  }

  createScf(input: { code: string; name: string; anchorBuyerId?: string }) {
    return this.prisma.scfProgram.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        code: input.code,
        name: input.name,
        anchorBuyerId: input.anchorBuyerId,
      },
    });
  }

  queueSwift(input: { mtType: string; body: string; relatedRef?: string }) {
    return this.prisma.tradeSwiftMessage.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        mtType: input.mtType,
        body: input.body,
        relatedRef: input.relatedRef,
      },
    });
  }

  async submitSwift(id: string) {
    const msg = await this.prisma.tradeSwiftMessage.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!msg) throw new NotFoundException("SWIFT message not found");
    return this.prisma.tradeSwiftMessage.update({
      where: { id },
      data: { status: "SENT_STUB" },
    });
  }

  async contingentOpenCount() {
    return this.prisma.letterOfCredit.count({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        status: { in: ["ISSUED", "ADVISED", "AMENDED", "DOCUMENTS_PRESENTED"] },
      },
    });
  }
}
`,
);

w(
  "modules/trade/trade.controller.ts",
  `import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
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
      makerUserId: req.user?.sub ?? "service",
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
      makerUserId: req.user?.sub ?? "service",
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

  @Post("swift")
  queueSwift(@Body() body: SwiftDto) {
    return this.trade.queueSwift(body);
  }

  @Post("swift/:id/submit")
  submitSwift(@Param("id") id: string) {
    return this.trade.submitSwift(id);
  }
}
`,
);

w(
  "modules/islamic/islamic.module.ts",
  `import { Module } from "@nestjs/common";
import { LedgerModule } from "../../kernel/ledger/ledger.module";
import { PostingEngineModule } from "../../kernel/posting-engine/posting-engine.module";
import { IslamicController } from "./islamic.controller";
import { IslamicService } from "./islamic.service";

@Module({
  imports: [LedgerModule, PostingEngineModule],
  controllers: [IslamicController],
  providers: [IslamicService],
  exports: [IslamicService],
})
export class IslamicModule {}
`,
);

w(
  "modules/islamic/islamic.service.ts",
  `import { Injectable, NotFoundException } from "@nestjs/common";
import { TxnType } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { assertIdempotencyKey } from "../../common/idempotency";
import { PostingEngineService } from "../../kernel/posting-engine/posting-engine.service";
import {
  SystemGlConfigService,
  SystemGlKey,
} from "../../kernel/ledger/system-gl-config.service";

@Injectable()
export class IslamicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly postingEngine: PostingEngineService,
    private readonly systemGl: SystemGlConfigService,
  ) {}

  list() {
    return this.prisma.islamicContract.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
    });
  }

  create(input: {
    customerId: string;
    productTemplateId: string;
    kind: string;
    principalMinor: string;
  }) {
    return this.prisma.islamicContract.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        productTemplateId: input.productTemplateId,
        kind: input.kind,
        principalMinor: BigInt(input.principalMinor),
      },
    });
  }

  async activate(input: {
    id: string;
    branchId: string;
    makerUserId: string;
    idempotencyKey: string;
    profitMinor?: string;
  }) {
    const key = assertIdempotencyKey(input.idempotencyKey);
    const c = await this.prisma.islamicContract.findFirst({
      where: { id: input.id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!c) throw new NotFoundException("Islamic contract not found");
    const asset = await this.systemGl.resolve(SystemGlKey.ISLAMIC_ASSET);
    const liab = await this.systemGl.resolve(SystemGlKey.ISLAMIC_LIABILITY);
    const amount = c.principalMinor;
    const txn = await this.postingEngine.post({
      reference: \`ISL-ACT:\${c.id}\`,
      idempotencyKey: key,
      valueDate: new Date(),
      type: TxnType.OPENING,
      makerUserId: input.makerUserId,
      branchId: input.branchId,
      autoApprove: true,
      legs: [
        {
          glAccountId: asset.id,
          branchId: input.branchId,
          debitMinor: amount,
          creditMinor: 0n,
          currency: c.currency,
        },
        {
          glAccountId: liab.id,
          branchId: input.branchId,
          debitMinor: 0n,
          creditMinor: amount,
          currency: c.currency,
        },
      ],
    });
    return this.prisma.islamicContract.update({
      where: { id: c.id },
      data: {
        status: "ACTIVE",
        profitMinor: BigInt(input.profitMinor ?? "0"),
        journalTxnId: txn.id,
      },
    });
  }
}
`,
);

w(
  "modules/islamic/islamic.controller.ts",
  `import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
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
      makerUserId: req.user?.sub ?? "service",
    });
  }
}
`,
);

w(
  "modules/wealth/wealth.module.ts",
  `import { Module } from "@nestjs/common";
import { WealthController } from "./wealth.controller";
import { WealthService } from "./wealth.service";

@Module({
  controllers: [WealthController],
  providers: [WealthService],
  exports: [WealthService],
})
export class WealthModule {}
`,
);

w(
  "modules/wealth/wealth.service.ts",
  `import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

@Injectable()
export class WealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  listSafekeeping() {
    return this.prisma.safekeepingAccount.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      include: { positions: true },
    });
  }

  createSafekeeping(input: {
    customerId: string;
    accountNo: string;
    currency?: string;
  }) {
    return this.prisma.safekeepingAccount.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        accountNo: input.accountNo,
        currency: input.currency ?? "AZN",
      },
    });
  }

  async receiveFop(input: {
    safekeepingAccountId: string;
    isin: string;
    quantity: string;
  }) {
    const acct = await this.prisma.safekeepingAccount.findFirst({
      where: {
        id: input.safekeepingAccountId,
        bankOrgId: this.bankOrg.bankOrgId,
      },
    });
    if (!acct) throw new NotFoundException("Safekeeping account not found");
    return this.prisma.custodyPosition.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        safekeepingAccountId: acct.id,
        isin: input.isin,
        quantity: input.quantity,
      },
    });
  }

  createInsuranceCommission(input: {
    customerId: string;
    policyRef: string;
    amountMinor: string;
  }) {
    return this.prisma.insuranceAffiliateCommission.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        policyRef: input.policyRef,
        amountMinor: BigInt(input.amountMinor),
      },
    });
  }
}
`,
);

w(
  "modules/wealth/wealth.controller.ts",
  `import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { WealthService } from "./wealth.service";

class CreateSafeDto {
  @IsString() customerId!: string;
  @IsString() accountNo!: string;
  @IsOptional() @IsString() currency?: string;
}
class ReceiveDto {
  @IsString() safekeepingAccountId!: string;
  @IsString() isin!: string;
  @IsString() quantity!: string;
}
class CommDto {
  @IsString() customerId!: string;
  @IsString() policyRef!: string;
  @IsString() amountMinor!: string;
}

@ApiTags("wealth")
@ApiBearerAuth()
@UseGuards(BankAuthGuard)
@Controller("wealth")
export class WealthController {
  constructor(private readonly wealth: WealthService) {}

  @Get("safekeeping")
  list() {
    return this.wealth.listSafekeeping();
  }

  @Post("safekeeping")
  create(@Body() body: CreateSafeDto) {
    return this.wealth.createSafekeeping(body);
  }

  @Post("positions/receive")
  receive(@Body() body: ReceiveDto) {
    return this.wealth.receiveFop(body);
  }

  @Post("insurance-commissions")
  commission(@Body() body: CommDto) {
    return this.wealth.createInsuranceCommission(body);
  }
}
`,
);

console.log("trade islamic wealth ok");
