import { Injectable } from "@nestjs/common";
import { ProductStatus, Prisma } from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";

@Injectable()
export class ProductFactoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  list() {
    return this.prisma.productTemplate.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { name: "asc" },
    });
  }

  create(data: {
    moduleKey: string;
    kind: import("@era/bank-core-database").ProductKind;
    name: string;
    currency: string;
    paramsJson: Record<string, unknown>;
    effectiveFrom: Date;
  }) {
    return this.prisma.productTemplate.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        moduleKey: data.moduleKey,
        kind: data.kind,
        name: data.name,
        currency: data.currency,
        paramsJson: data.paramsJson as Prisma.InputJsonValue,
        effectiveFrom: data.effectiveFrom,
        status: ProductStatus.DRAFT,
      },
    });
  }
}
