import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ProductKind,
  ProductStatus,
  Prisma,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import {
  isDepositKind,
  isLoanKind,
  moduleKeyForKind,
  parseProductParams,
  paramHintsForKind,
  validateProductParams,
} from "./product-params";

export type ProductTemplateRow = {
  id: string;
  bankOrgId: string;
  moduleKey: string;
  kind: ProductKind;
  name: string;
  currency: string;
  paramsJson: Prisma.JsonValue;
  status: ProductStatus;
  effectiveFrom: Date;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ProductFactoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
  ) {}

  list(filters?: { kind?: ProductKind; status?: ProductStatus }) {
    return this.prisma.productTemplate.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(filters?.kind ? { kind: filters.kind } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  async getById(id: string): Promise<ProductTemplateRow> {
    const row = await this.prisma.productTemplate.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!row) throw new NotFoundException("Product template not found");
    return row;
  }

  create(data: {
    kind: ProductKind;
    name: string;
    currency: string;
    paramsJson: Record<string, unknown>;
    effectiveFrom: Date;
    moduleKey?: string;
  }) {
    validateProductParams(data.kind, data.paramsJson);
    const moduleKey = data.moduleKey?.trim() || moduleKeyForKind(data.kind);
    return this.prisma.productTemplate.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        moduleKey,
        kind: data.kind,
        name: data.name,
        currency: data.currency,
        paramsJson: data.paramsJson as Prisma.InputJsonValue,
        effectiveFrom: data.effectiveFrom,
        status: ProductStatus.DRAFT,
      },
    });
  }

  async update(
    id: string,
    patch: {
      name?: string;
      currency?: string;
      kind?: ProductKind;
      paramsJson?: Record<string, unknown>;
      effectiveFrom?: Date;
      moduleKey?: string;
    },
  ) {
    const existing = await this.getById(id);

    if (existing.status === ProductStatus.RETIRED) {
      throw new BadRequestException("Cannot edit a retired product template");
    }

    if (existing.status === ProductStatus.ACTIVE) {
      if (patch.kind != null && patch.kind !== existing.kind) {
        throw new BadRequestException("Cannot change kind on an ACTIVE product");
      }
      if (patch.currency != null && patch.currency !== existing.currency) {
        throw new BadRequestException(
          "Cannot change currency on an ACTIVE product",
        );
      }
    }

    const nextKind = patch.kind ?? existing.kind;
    const nextParams =
      patch.paramsJson ??
      (existing.paramsJson as Record<string, unknown>);
    validateProductParams(nextKind, nextParams);

    const moduleKey =
      patch.moduleKey?.trim() ||
      (patch.kind ? moduleKeyForKind(patch.kind) : existing.moduleKey);

    return this.prisma.productTemplate.update({
      where: { id },
      data: {
        name: patch.name ?? existing.name,
        currency:
          existing.status === ProductStatus.DRAFT
            ? (patch.currency ?? existing.currency)
            : existing.currency,
        kind:
          existing.status === ProductStatus.DRAFT
            ? (patch.kind ?? existing.kind)
            : existing.kind,
        moduleKey,
        paramsJson: nextParams as Prisma.InputJsonValue,
        effectiveFrom: patch.effectiveFrom ?? existing.effectiveFrom,
      },
    });
  }

  async activate(id: string) {
    const existing = await this.getById(id);
    if (existing.status !== ProductStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT templates can be activated");
    }
    validateProductParams(existing.kind, existing.paramsJson);
    return this.prisma.productTemplate.update({
      where: { id },
      data: { status: ProductStatus.ACTIVE },
    });
  }

  async retire(id: string) {
    const existing = await this.getById(id);
    if (existing.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException("Only ACTIVE templates can be retired");
    }
    return this.prisma.productTemplate.update({
      where: { id },
      data: { status: ProductStatus.RETIRED },
    });
  }

  /**
   * Origination gate: ACTIVE template of an allowed kind for this bank org.
   */
  async assertActiveProduct(
    id: string,
    allowedKinds: ProductKind[],
  ): Promise<ProductTemplateRow> {
    const row = await this.getById(id);
    if (row.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException(
        `Product template must be ACTIVE (was ${row.status})`,
      );
    }
    if (!allowedKinds.includes(row.kind)) {
      throw new BadRequestException(
        `Product kind ${row.kind} is not allowed for this operation`,
      );
    }
    validateProductParams(row.kind, row.paramsJson);
    return row;
  }

  async assertActiveDepositProduct(id: string) {
    return this.assertActiveProduct(id, [
      ProductKind.TERM_DEPOSIT,
      ProductKind.SAVINGS,
      ProductKind.CALL_DEPOSIT,
      ProductKind.STRUCTURED_DEPOSIT,
    ]);
  }

  async assertActiveLoanProduct(id: string) {
    return this.assertActiveProduct(id, [
      ProductKind.LOAN_ANNUITY,
      ProductKind.LOAN_DIFF,
      ProductKind.LOAN_LINE,
      ProductKind.LOAN_MORTGAGE,
      ProductKind.LOAN_LEASE,
      ProductKind.LOAN_FACTORING,
      ProductKind.LOAN_MFI,
      ProductKind.LOAN_TRADE,
      ProductKind.LOAN_SYNDICATED,
      ProductKind.LOAN_PROJECT,
      ProductKind.MURABAHA,
      ProductKind.MUDARABAH,
    ]);
  }

  async assertActiveCardProduct(id: string) {
    return this.assertActiveProduct(id, [ProductKind.CARD]);
  }

  async assertActiveCurrentProduct(id: string) {
    return this.assertActiveProduct(id, [ProductKind.CURRENT]);
  }

  parseParamsFor(row: ProductTemplateRow) {
    return parseProductParams(row.kind, row.paramsJson);
  }

  isDepositKind = isDepositKind;
  isLoanKind = isLoanKind;

  paramHints(kind: ProductKind) {
    return paramHintsForKind(kind);
  }
}
