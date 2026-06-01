import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import type { StockCheckDto } from "./dto/stock-check.dto";
import type { RateQuoteDto } from "./dto/rate-quote.dto";
import type { CodClearingDto } from "./dto/cod-clearing.dto";
import type { SupplierMatchDto } from "./dto/supplier-match.dto";
import type { ExternalPurchaseDto } from "./dto/external-purchase.dto";
import type { EligibilityCheckDto } from "./dto/eligibility-check.dto";

@Injectable()
export class IndustryHandoffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async stockCheck(organizationId: string, dto: StockCheckDto) {
    const product = await this.prisma.product.findFirst({
      where: {
        organizationId,
        OR: [
          { sku: dto.sku },
          ...(dto.barcode ? [{ sku: dto.barcode }] : []),
        ],
        deletedAt: null,
      },
    });
    if (!product) {
      throw new NotFoundException(`Product not found for sku ${dto.sku}`);
    }

    const stockWhere: Prisma.StockItemWhereInput = {
      organizationId,
      productId: product.id,
      deletedAt: null,
      ...(dto.warehouseId ? { warehouseId: dto.warehouseId } : {}),
    };
    const items = await this.prisma.stockItem.findMany({
      where: stockWhere,
      include: { warehouse: { select: { id: true, name: true } } },
    });
    const systemQty = items.reduce((s, i) => s + Number(i.quantity), 0);
    const actualQty = dto.actualQty ?? systemQty;
    const variance = actualQty - systemQty;

    const log = await this.prisma.industryStockCheckLog.create({
      data: {
        organizationId,
        productId: product.id,
        sku: product.sku,
        warehouseId: dto.warehouseId ?? items[0]?.warehouseId ?? null,
        systemQty: new Prisma.Decimal(systemQty),
        actualQty: new Prisma.Decimal(actualQty),
        variance: new Prisma.Decimal(variance),
      },
    });

    return {
      checkId: log.id,
      sku: product.sku,
      productName: product.name,
      systemQty,
      actualQty,
      variance,
      match: variance === 0,
      warehouses: items.map((i) => ({
        warehouseId: i.warehouseId,
        warehouseName: i.warehouse.name,
        quantity: Number(i.quantity),
      })),
    };
  }

  async replenishmentSuggestions(organizationId: string) {
    const settings = (await this.inventory.getInventorySettings(organizationId)) as {
      minStockThreshold?: number;
    };
    const threshold = Number(settings?.minStockThreshold ?? 5);

    const stockItems = await this.prisma.stockItem.findMany({
      where: { organizationId, deletedAt: null },
      include: { product: { select: { id: true, sku: true, name: true } } },
      take: 200,
    });

    const low = stockItems.filter((s) => Number(s.quantity) < threshold);
    const suggestions = await Promise.all(
      low.map(async (item) => {
        const suggestedQty = Math.max(threshold * 2 - Number(item.quantity), 1);
        const row = await this.prisma.industryReplenishmentSuggestion.upsert({
          where: {
            organizationId_productId: {
              organizationId,
              productId: item.productId,
            },
          },
          create: {
            organizationId,
            productId: item.productId,
            sku: item.product.sku,
            warehouseId: item.warehouseId,
            currentQty: item.quantity,
            suggestedQty: new Prisma.Decimal(suggestedQty),
            status: "OPEN",
          },
          update: {
            currentQty: item.quantity,
            suggestedQty: new Prisma.Decimal(suggestedQty),
            status: "OPEN",
          },
        });
        return {
          id: row.id,
          sku: item.product.sku,
          productName: item.product.name,
          warehouseId: item.warehouseId,
          currentQty: Number(item.quantity),
          suggestedQty,
          status: row.status,
        };
      }),
    );

    return { threshold, suggestions };
  }

  async supplierMatch(organizationId: string, dto: SupplierMatchDto) {
    let purchaseTransactionId = dto.purchaseTransactionId ?? null;
    let matchStatus: "MATCHED" | "PENDING" | "UNMATCHED" = "PENDING";

    if (purchaseTransactionId) {
      const tx = await this.prisma.transaction.findFirst({
        where: { id: purchaseTransactionId, organizationId },
      });
      matchStatus = tx ? "MATCHED" : "UNMATCHED";
    } else if (dto.counterpartyId) {
      const tx = await this.prisma.transaction.findFirst({
        where: {
          organizationId,
          counterpartyId: dto.counterpartyId,
          purchaseSnapshot: { not: Prisma.DbNull },
        },
        orderBy: { createdAt: "desc" },
      });
      if (tx) {
        purchaseTransactionId = tx.id;
        matchStatus = "MATCHED";
      } else {
        matchStatus = "UNMATCHED";
      }
    }

    const row = await this.prisma.industrySupplierInvoiceMatch.create({
      data: {
        organizationId,
        invoiceRef: dto.invoiceRef,
        purchaseTransactionId,
        counterpartyId: dto.counterpartyId ?? null,
        matchStatus,
      },
    });

    return {
      matchId: row.id,
      invoiceRef: row.invoiceRef,
      purchaseTransactionId: row.purchaseTransactionId,
      matchStatus: row.matchStatus,
    };
  }

  async rateQuote(organizationId: string, dto: RateQuoteDto) {
    const rules = await this.prisma.industryTariffRule.findMany({
      where: {
        organizationId,
        active: true,
        ...(dto.zoneFrom ? { zoneFrom: dto.zoneFrom } : {}),
        ...(dto.zoneTo ? { zoneTo: dto.zoneTo } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 1,
    });

    let rule = rules[0];
    if (!rule) {
      rule = await this.prisma.industryTariffRule.create({
        data: {
          organizationId,
          name: "Default v1.1",
          zoneFrom: dto.zoneFrom ?? "*",
          zoneTo: dto.zoneTo ?? "*",
          baseRate: new Prisma.Decimal(5),
          perKgRate: new Prisma.Decimal(1.2),
        },
      });
    }

    const amount =
      Number(rule.baseRate) + Number(rule.perKgRate) * dto.weightKg;
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      zoneFrom: rule.zoneFrom,
      zoneTo: rule.zoneTo,
      weightKg: dto.weightKg,
      amount: Math.round(amount * 100) / 100,
      currency: rule.currency,
    };
  }

  async codClearing(organizationId: string, dto: CodClearingDto) {
    const driver = dto.driverShare ?? dto.totalCod * 0.7;
    const hub = dto.hubShare ?? dto.totalCod - driver;
    const client = Math.max(dto.totalCod - driver - hub, 0);

    const row = await this.prisma.industryCodSettlement.create({
      data: {
        organizationId,
        shipmentRef: dto.shipmentRef,
        totalCod: new Prisma.Decimal(dto.totalCod),
        driverShare: new Prisma.Decimal(driver),
        hubShare: new Prisma.Decimal(hub),
        clientShare: new Prisma.Decimal(client),
        status: "SETTLED",
      },
    });

    return {
      settlementId: row.id,
      shipmentRef: row.shipmentRef,
      totalCod: Number(row.totalCod),
      driverShare: Number(row.driverShare),
      hubShare: Number(row.hubShare),
      clientShare: Number(row.clientShare),
      status: row.status,
    };
  }

  async eligibilityCheck(organizationId: string, dto: EligibilityCheckDto) {
    if (dto.counterpartyId) {
      const cp = await this.prisma.counterparty.findFirst({
        where: { id: dto.counterpartyId, organizationId },
      });
      if (!cp) {
        return { eligible: false, reason: "COUNTERPARTY_NOT_FOUND" };
      }
    }

    const eligible =
      Boolean(dto.policyNumber) || Boolean(dto.counterpartyId) || Boolean(dto.patientFin);
    return {
      eligible,
      policyNumber: dto.policyNumber ?? null,
      coveragePercent: eligible ? 80 : 0,
      reason: eligible ? "STUB_OK" : "MISSING_IDENTIFIERS",
      checkedAt: new Date().toISOString(),
    };
  }

  async externalPurchase(organizationId: string, dto: ExternalPurchaseDto) {
    if (!dto.lines?.length) {
      throw new BadRequestException("At least one line required");
    }

    const products = await Promise.all(
      dto.lines.map((line) =>
        this.prisma.product.findFirst({
          where: { organizationId, sku: line.sku, deletedAt: null },
        }),
      ),
    );

    const missing = dto.lines.filter((_, i) => !products[i]).map((l) => l.sku);
    if (missing.length) {
      throw new BadRequestException(`Unknown SKUs: ${missing.join(", ")}`);
    }

    const result = await this.inventory.recordPurchase(organizationId, {
      counterpartyId: dto.counterpartyId,
      documentDate: new Date().toISOString().slice(0, 10),
      reference: dto.externalRef,
      lines: dto.lines.map((line, i) => ({
        productId: products[i]!.id,
        quantity: line.quantity,
        unitPrice: line.unitPrice ?? Number(products[i]!.price),
      })),
      pricesIncludeVat: false,
    });

    return {
      externalRef: dto.externalRef,
      purchase: result,
    };
  }
}
