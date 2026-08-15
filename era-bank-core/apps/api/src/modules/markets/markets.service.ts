import { Injectable, NotFoundException } from "@nestjs/common";
import { MarketsBookStatus } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

@Injectable()
export class MarketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  listDerivatives() {
    return this.prisma.derivativeContract.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { contractRef: "asc" },
    });
  }

  createDerivative(input: {
    contractRef: string;
    productType: string;
    notionalMinor: string;
    currency?: string;
  }) {
    return this.prisma.derivativeContract.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        contractRef: input.contractRef,
        productType: input.productType,
        notionalMinor: BigInt(input.notionalMinor),
        currency: input.currency ?? "AZN",
      },
    });
  }

  async bookDerivative(id: string) {
    const row = await this.prisma.derivativeContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!row) throw new NotFoundException("Derivative contract not found");
    return this.prisma.derivativeContract.update({
      where: { id },
      data: { status: MarketsBookStatus.BOOKED, bookedAt: new Date() },
    });
  }

  async cancelDerivative(id: string) {
    const row = await this.prisma.derivativeContract.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!row) throw new NotFoundException("Derivative contract not found");
    return this.prisma.derivativeContract.update({
      where: { id },
      data: { status: MarketsBookStatus.CANCELLED },
    });
  }

  listBonds() {
    return this.prisma.bondPosition.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { isin: "asc" },
    });
  }

  createBond(input: {
    isin: string;
    faceValueMinor: string;
    currency?: string;
  }) {
    return this.prisma.bondPosition.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        isin: input.isin,
        faceValueMinor: BigInt(input.faceValueMinor),
        currency: input.currency ?? "AZN",
      },
    });
  }

  async bookBond(id: string) {
    const row = await this.prisma.bondPosition.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!row) throw new NotFoundException("Bond position not found");
    return this.prisma.bondPosition.update({
      where: { id },
      data: { status: MarketsBookStatus.BOOKED, bookedAt: new Date() },
    });
  }

  async cancelBond(id: string) {
    const row = await this.prisma.bondPosition.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!row) throw new NotFoundException("Bond position not found");
    return this.prisma.bondPosition.update({
      where: { id },
      data: { status: MarketsBookStatus.CANCELLED },
    });
  }
}
