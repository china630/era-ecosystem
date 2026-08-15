import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { FeeTariffStatus, TxnType } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { BankErrorCode } from "../../common/bank-error-codes";
import { assertIdempotencyKey } from "../../common/idempotency";
import { applyPackageWaiver } from "../../common/fc1-core.util";
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

  listPackageTariffs(packageId: string) {
    return this.prisma.relationshipPackageTariff.findMany({
      where: { packageId, bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { tariffCode: "asc" },
    });
  }

  linkPackageTariff(input: {
    packageId: string;
    tariffCode: string;
    waiverType: string;
    waiverValue?: string;
  }) {
    return this.prisma.relationshipPackageTariff.upsert({
      where: {
        packageId_tariffCode: {
          packageId: input.packageId,
          tariffCode: input.tariffCode,
        },
      },
      create: {
        bankOrgId: this.bankOrg.bankOrgId,
        packageId: input.packageId,
        tariffCode: input.tariffCode,
        waiverType: input.waiverType,
        waiverValue:
          input.waiverValue != null ? BigInt(input.waiverValue) : null,
      },
      update: {
        waiverType: input.waiverType,
        waiverValue:
          input.waiverValue != null ? BigInt(input.waiverValue) : null,
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
    customerId?: string;
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
        message: `Unknown tariff ${input.tariffCode}`,
      });
    }
    let amount = BigInt(input.amountMinor ?? tariff.amountMinor.toString());

    if (input.customerId) {
      const link = await this.prisma.relationshipPackageLink.findFirst({
        where: {
          customerId: input.customerId,
          bankOrgId: this.bankOrg.bankOrgId,
        },
      });
      if (link) {
        const packageTariff =
          await this.prisma.relationshipPackageTariff.findUnique({
            where: {
              packageId_tariffCode: {
                packageId: link.packageId,
                tariffCode: input.tariffCode,
              },
            },
          });
        if (packageTariff) {
          amount = applyPackageWaiver(
            amount,
            packageTariff.waiverType,
            packageTariff.waiverValue,
          );
        }
      }
    }

    if (amount <= 0n) {
      return {
        tariff,
        amountMinor: "0",
        journalTxnId: null,
        waived: true,
      };
    }
    const feeIncome = await this.systemGl.resolve(SystemGlKey.FEE_INCOME);
    const cashVault = await this.systemGl.resolve(SystemGlKey.CASH_VAULT);
    const txn = await this.postingEngine.post({
      reference: `FEE:${tariff.code}`,
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
