import { Injectable, NotFoundException } from "@nestjs/common";
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
      include: { positions: { include: { ledgerEntries: true } } },
    });
  }

  createSafekeeping(input: {
    customerId: string;
    accountNo: string;
    csdAccountNo?: string;
    currency?: string;
  }) {
    return this.prisma.safekeepingAccount.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        accountNo: input.accountNo,
        csdAccountNo: input.csdAccountNo,
        currency: input.currency ?? "AZN",
      },
    });
  }

  async receiveFop(input: {
    safekeepingAccountId: string;
    isin: string;
    quantity: string;
    reference?: string;
  }) {
    const acct = await this.prisma.safekeepingAccount.findFirst({
      where: {
        id: input.safekeepingAccountId,
        bankOrgId: this.bankOrg.bankOrgId,
      },
    });
    if (!acct) throw new NotFoundException("Safekeeping account not found");
    const position = await this.prisma.custodyPosition.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        safekeepingAccountId: acct.id,
        isin: input.isin,
        quantity: input.quantity,
      },
    });
    await this.prisma.custodyPositionLedger.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        custodyPositionId: position.id,
        direction: "RECEIVE",
        quantity: input.quantity,
        reference: input.reference ?? `FOP-${input.isin}`,
      },
    });
    return position;
  }

  listInsuranceProducts() {
    return this.prisma.insuranceProduct.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      include: { policies: true },
    });
  }

  createInsuranceProduct(input: {
    code: string;
    name: string;
    partnerName: string;
    commissionBps?: number;
  }) {
    return this.prisma.insuranceProduct.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        code: input.code,
        name: input.name,
        partnerName: input.partnerName,
        commissionBps: input.commissionBps ?? 0,
      },
    });
  }

  linkInsurancePolicy(input: {
    customerId: string;
    insuranceProductId: string;
    policyRef: string;
    premiumMinor: string;
    currency?: string;
  }) {
    return this.prisma.insurancePolicyLink.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        insuranceProductId: input.insuranceProductId,
        policyRef: input.policyRef,
        premiumMinor: BigInt(input.premiumMinor),
        currency: input.currency ?? "AZN",
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

  listCsdAccounts() {
    return this.prisma.csdAccount.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { csdAccountNo: "asc" },
    });
  }

  createCsdAccount(input: { customerId: string; csdAccountNo: string }) {
    return this.prisma.csdAccount.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        csdAccountNo: input.csdAccountNo,
      },
    });
  }

  listBrokerageOrders() {
    return this.prisma.brokerageOrder.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  createBrokerageOrder(input: {
    customerId: string;
    isin: string;
    side: string;
    quantity: string;
    limitPriceMinor?: string;
  }) {
    return this.prisma.brokerageOrder.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        isin: input.isin,
        side: input.side,
        quantity: input.quantity,
        limitPriceMinor: input.limitPriceMinor
          ? BigInt(input.limitPriceMinor)
          : undefined,
      },
    });
  }

  listMetalPositions() {
    return this.prisma.metalPosition.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { createdAt: "desc" },
    });
  }

  createMetalPosition(input: {
    customerId: string;
    metalCode: string;
    weightGrams: string;
  }) {
    return this.prisma.metalPosition.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        customerId: input.customerId,
        metalCode: input.metalCode,
        weightGrams: input.weightGrams,
      },
    });
  }
}
