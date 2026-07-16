import { Injectable, NotFoundException } from "@nestjs/common";
import { ForeignInvoicePrefillSchema } from "@erafinance/api-contracts";
import { Prisma, TradeContext } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { LandedCostService } from "./landed-cost.service";
import type { LandedCostAllocationMethod } from "./dto/landed-cost.dto";

export type ImportPipelineStep = {
  step: string;
  status: "OK" | "SKIPPED" | "ERROR" | "PENDING";
  detail: string;
  refId?: string;
};

export type ImportPipelineResult = {
  steps: ImportPipelineStep[];
  purchaseTransactionId?: string;
  customsDeclarationId?: string;
  landedCost?: Awaited<ReturnType<LandedCostService["allocate"]>>;
};

@Injectable()
export class ImportPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly landedCost: LandedCostService,
  ) {}

  async run(
    organizationId: string,
    ocrJobId: string,
    customsDeclarationId?: string,
    landedCostMethod: LandedCostAllocationMethod = "STAT_VALUE",
  ): Promise<ImportPipelineResult> {
    const steps: ImportPipelineStep[] = [];

    const ocrRows = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; status: string; result_json: unknown }>
    >(
      `SELECT id, status::text, result_json FROM ocr_jobs WHERE id = $1::uuid AND organization_id = $2::uuid LIMIT 1`,
      ocrJobId,
      organizationId,
    );
    const ocrRow = ocrRows[0];
    if (!ocrRow) {
      throw new NotFoundException("OCR job not found");
    }

    if (ocrRow.status !== "DONE") {
      steps.push({
        step: "OCR",
        status: "ERROR",
        detail: `OCR job status is ${ocrRow.status}; wait for DONE`,
      });
      return { steps };
    }

    const parsed = ForeignInvoicePrefillSchema.safeParse(ocrRow.result_json);
    if (!parsed.success) {
      steps.push({
        step: "OCR",
        status: "ERROR",
        detail: "OCR result is not a valid foreign invoice prefill",
      });
      return { steps };
    }

    steps.push({
      step: "OCR",
      status: "OK",
      detail: `Recognized invoice ${parsed.data.number} (${parsed.data.currency})`,
      refId: ocrJobId,
    });

    const snapshotLines = parsed.data.items.map((line) => ({
      kind: "goods" as const,
      productId: null as string | null,
      quantity: line.quantity,
      productName: line.name,
      sku: line.sku ?? "",
      ocrUnitPrice: line.unitPriceAzn,
    }));

    const draft = await this.prisma.transaction.create({
      data: {
        organizationId,
        date: new Date(parsed.data.issueDate.slice(0, 10)),
        reference: parsed.data.number,
        description: `Import pipeline draft — foreign invoice ${parsed.data.number} (${parsed.data.supplier.name})`,
        isFinal: false,
        tradeContext: TradeContext.IMPORT,
        incoterms: null,
        purchaseSnapshot: {
          version: 1,
          source: "OCR_IMPORT_PIPELINE",
          ocrJobId,
          supplier: parsed.data.supplier,
          currency: parsed.data.currency,
          lines: snapshotLines,
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    steps.push({
      step: "PURCHASE_DRAFT",
      status: "OK",
      detail:
        "Draft purchase transaction created (GL not posted — map products and post via Alış fakturası)",
      refId: draft.id,
    });

    let landedCostResult: ImportPipelineResult["landedCost"];
    let linkedDeclarationId = customsDeclarationId;

    if (!linkedDeclarationId) {
      steps.push({
        step: "CUSTOMS_LINK",
        status: "SKIPPED",
        detail: "No customsDeclarationId supplied — link BGD manually then allocate landed cost",
      });
    } else {
      const decl = await this.prisma.customsDeclaration.findFirst({
        where: { id: linkedDeclarationId, organizationId, deletedAt: null },
      });
      if (!decl) {
        steps.push({
          step: "CUSTOMS_LINK",
          status: "ERROR",
          detail: "Customs declaration not found",
        });
      } else {
        await this.prisma.customsDeclaration.update({
          where: { id: linkedDeclarationId },
          data: { linkedPurchaseTransactionId: draft.id },
        });
        steps.push({
          step: "CUSTOMS_LINK",
          status: "OK",
          detail: `Linked BGD ${decl.bgdNumber} to purchase draft`,
          refId: linkedDeclarationId,
        });

        try {
          landedCostResult = await this.landedCost.allocate(
            organizationId,
            linkedDeclarationId,
            landedCostMethod,
          );
          steps.push({
            step: "LANDED_COST",
            status: "OK",
            detail: `Allocated ${landedCostResult.items.length} SKU lines (${landedCostMethod})`,
          });
        } catch (e) {
          steps.push({
            step: "LANDED_COST",
            status: "ERROR",
            detail:
              e instanceof Error
                ? e.message
                : "Landed cost allocation failed — link products on BGD lines first",
          });
        }
      }
    }

    if (linkedDeclarationId && !steps.some((s) => s.step === "LANDED_COST")) {
      steps.push({
        step: "LANDED_COST",
        status: "PENDING",
        detail: "Run POST …/allocate-landed-cost after mapping BGD lines to products",
      });
    }

    return {
      steps,
      purchaseTransactionId: draft.id,
      customsDeclarationId: linkedDeclarationId,
      landedCost: landedCostResult,
    };
  }
}
