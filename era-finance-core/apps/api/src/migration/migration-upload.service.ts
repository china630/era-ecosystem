import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  CounterpartyLegalForm,
  MigrationDraftKind,
  MigrationDraftStatus,
  Prisma,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { CounterpartiesService } from "../counterparties/counterparties.service";
import { ProductsService } from "../products/products.service";
import { blindIndex, normalizeVoen } from "../security/pii-crypto.util";
import {
  draftSlugToEnum,
  isDraftKindSlug,
  isMasterKind,
  TEMPLATE_SPECS,
  type MigrationDraftKindSlug,
  type MigrationUploadKind,
} from "./migration-kinds";
import {
  buildErrorWorkbook,
  cellNumber,
  cellText,
  colIndex,
  loadFirstSheet,
} from "./migration-xlsx.util";

const Decimal = Prisma.Decimal;

export type UploadResult = {
  kind: string;
  created: number;
  errors: number;
  errorRows: Array<{ row: number; error: string }>;
  errorFileBase64?: string;
  batchId?: string;
};

@Injectable()
export class MigrationUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counterparties: CounterpartiesService,
    private readonly products: ProductsService,
  ) {}

  async upload(params: {
    organizationId: string;
    userId: string | null;
    kind: string;
    file: Express.Multer.File;
  }): Promise<UploadResult> {
    const kind = params.kind as MigrationUploadKind;
    if (!isMasterKind(kind) && !isDraftKindSlug(kind)) {
      throw new BadRequestException(`Unknown migration kind: ${params.kind}`);
    }
    if (!params.file?.buffer?.length) {
      throw new BadRequestException("file is required");
    }

    const org = await this.prisma.organization.findFirst({
      where: { id: params.organizationId, deletedAt: null },
      select: { migrationAssembledAt: true },
    });
    if (!org) throw new BadRequestException("Organization not found");

    if (isDraftKindSlug(kind) && org.migrationAssembledAt) {
      throw new ConflictException(
        "Opening drafts are locked after assemble; master uploads remain available",
      );
    }

    let result: UploadResult;
    if (isMasterKind(kind)) {
      result = await this.uploadMaster(params.organizationId, kind, params.file);
    } else {
      result = await this.uploadDraft(
        params.organizationId,
        params.userId,
        kind,
        params.file,
      );
    }

    await this.prisma.migrationUploadLog.create({
      data: {
        organizationId: params.organizationId,
        kind,
        fileName: params.file.originalname ?? null,
        createdCount: result.created,
        errorCount: result.errors,
        uploadedByUserId: params.userId,
      },
    });

    return result;
  }

  private async uploadMaster(
    organizationId: string,
    kind: MigrationUploadKind,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    switch (kind) {
      case "counterparties":
        return this.uploadCounterparties(organizationId, file);
      case "products":
        return this.uploadProducts(organizationId, file);
      case "warehouses":
        return this.uploadWarehouses(organizationId, file);
      case "recipes":
        return this.uploadRecipes(organizationId, file);
      default:
        throw new BadRequestException(`Not a master kind: ${kind}`);
    }
  }

  private async uploadCounterparties(
    organizationId: string,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    const { sheet, header } = await loadFirstSheet(file.buffer);
    const cParty = colIndex(header, "partyKind");
    const cVoen = colIndex(header, "voen");
    const cName = colIndex(header, "name");
    const cForm = colIndex(header, "legalForm");
    if (cParty < 0 || cVoen < 0 || cName < 0 || cForm < 0) {
      throw new BadRequestException(
        "header must include partyKind, voen, name, legalForm",
      );
    }
    let created = 0;
    const errorRows: Array<{
      row: number;
      error: string;
      values: Record<string, string | number>;
    }> = [];

    for (let r = 2; r <= sheet.rowCount; r += 1) {
      const partyKind = cellText(sheet, r, cParty).toLowerCase();
      const voen = cellText(sheet, r, cVoen);
      const name = cellText(sheet, r, cName);
      const legalRaw = cellText(sheet, r, cForm).toUpperCase();
      const values = { partyKind, voen, name, legalForm: legalRaw };
      if (!voen && !name) continue;
      if (partyKind !== "company" && partyKind !== "agency") {
        errorRows.push({ row: r, error: "partyKind must be company or agency", values });
        continue;
      }
      if (!(Object.values(CounterpartyLegalForm) as string[]).includes(legalRaw)) {
        errorRows.push({ row: r, error: `unknown legalForm ${legalRaw}`, values });
        continue;
      }
      if (legalRaw === CounterpartyLegalForm.INDIVIDUAL) {
        errorRows.push({ row: r, error: "individual guests are not imported here", values });
        continue;
      }
      const normalized = normalizeVoen(voen);
      if (!/^\d{10}$/.test(normalized)) {
        errorRows.push({ row: r, error: "voen must be 10 digits", values });
        continue;
      }
      const taxIdBlindIndex = blindIndex("voen", normalized);
      const existing = await this.prisma.counterparty.findFirst({
        where: { organizationId, taxIdBlindIndex, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        errorRows.push({ row: r, error: "already exists (voen)", values });
        continue;
      }
      try {
        const linked = await this.counterparties.findOrCreateByVoen({
          organizationId,
          taxId: normalized,
          nameFallback: name,
        });
        await this.prisma.counterparty.update({
          where: { id: linked.id },
          data: { legalForm: legalRaw as CounterpartyLegalForm },
        });
        created += 1;
      } catch (err) {
        errorRows.push({
          row: r,
          error: err instanceof Error ? err.message : "failed",
          values,
        });
      }
    }

    return this.finishWithErrors("counterparties", created, errorRows, [
      "partyKind",
      "voen",
      "name",
      "legalForm",
    ]);
  }

  private async uploadProducts(
    organizationId: string,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    const { sheet, header } = await loadFirstSheet(file.buffer);
    const cSku = colIndex(header, "sku");
    const cName = colIndex(header, "name");
    const cPrice = colIndex(header, "price");
    if (cSku < 0 || cName < 0 || cPrice < 0) {
      throw new BadRequestException("header must include sku, name, price");
    }
    const cVat = colIndex(header, "vatRate");
    const cSvc = colIndex(header, "isService");
    const cRev = colIndex(header, "revenueAccountCode");
    const cCat = colIndex(header, "category");
    let created = 0;
    const errorRows: Array<{
      row: number;
      error: string;
      values: Record<string, string | number>;
    }> = [];

    for (let r = 2; r <= sheet.rowCount; r += 1) {
      const sku = cellText(sheet, r, cSku);
      const name = cellText(sheet, r, cName);
      if (!sku && !name) continue;
      const price = cellNumber(sheet, r, cPrice);
      const vatRate = cVat >= 0 ? cellNumber(sheet, r, cVat) ?? 0 : 0;
      const serviceRaw = cellText(sheet, r, cSvc).toLowerCase();
      const isService =
        serviceRaw === "true" ||
        serviceRaw === "1" ||
        serviceRaw === "yes" ||
        serviceRaw === "service";
      const revenue = cellText(sheet, r, cRev);
      const category = cellText(sheet, r, cCat);
      const values: Record<string, string | number> = {
        sku,
        name,
        price: price ?? "",
        vatRate,
        isService: String(isService),
        revenueAccountCode: revenue,
        category,
      };
      if (!sku || price === null) {
        errorRows.push({ row: r, error: "sku and price are required", values });
        continue;
      }
      const existing = await this.prisma.product.findFirst({
        where: { organizationId, sku, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        errorRows.push({ row: r, error: "already exists (sku)", values });
        continue;
      }
      try {
        await this.products.create(organizationId, {
          sku,
          name,
          price,
          vatRate,
          isService,
          ...(revenue ? { revenueAccountCode: revenue } : {}),
          ...(category ? { category } : {}),
        });
        created += 1;
      } catch (err) {
        errorRows.push({
          row: r,
          error: err instanceof Error ? err.message : "failed",
          values,
        });
      }
    }

    return this.finishWithErrors("products", created, errorRows, [
      "sku",
      "name",
      "price",
      "vatRate",
      "isService",
      "revenueAccountCode",
      "category",
    ]);
  }

  private async uploadWarehouses(
    organizationId: string,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    const { sheet, header } = await loadFirstSheet(file.buffer);
    const cCode = colIndex(header, "code");
    const cName = colIndex(header, "name");
    if (cCode < 0 || cName < 0) {
      throw new BadRequestException("header must include code, name");
    }
    let created = 0;
    const errorRows: Array<{
      row: number;
      error: string;
      values: Record<string, string | number>;
    }> = [];

    for (let r = 2; r <= sheet.rowCount; r += 1) {
      const code = cellText(sheet, r, cCode);
      const name = cellText(sheet, r, cName);
      if (!code && !name) continue;
      const values = { code, name };
      if (!code || !name) {
        errorRows.push({ row: r, error: "code and name are required", values });
        continue;
      }
      const existing = await this.prisma.warehouse.findFirst({
        where: { organizationId, code, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        errorRows.push({ row: r, error: "already exists (code)", values });
        continue;
      }
      try {
        await this.prisma.warehouse.create({
          data: { organizationId, code, name },
        });
        created += 1;
      } catch (err) {
        errorRows.push({
          row: r,
          error: err instanceof Error ? err.message : "failed",
          values,
        });
      }
    }

    return this.finishWithErrors("warehouses", created, errorRows, ["code", "name"]);
  }

  private async uploadRecipes(
    organizationId: string,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { migrationAssembledAt: true },
    });
    const assembled = Boolean(org?.migrationAssembledAt);

    const { sheet, header } = await loadFirstSheet(file.buffer);
    const cDish = colIndex(header, "dishSku");
    const cComp = colIndex(header, "componentSku");
    const cQty = colIndex(header, "quantity");
    if (cDish < 0 || cComp < 0 || cQty < 0) {
      throw new BadRequestException(
        "header must include dishSku, componentSku, quantity",
      );
    }

    type Line = { dishSku: string; componentSku: string; quantity: number; row: number };
    const groups = new Map<string, Line[]>();
    const errorRows: Array<{
      row: number;
      error: string;
      values: Record<string, string | number>;
    }> = [];

    for (let r = 2; r <= sheet.rowCount; r += 1) {
      const dishSku = cellText(sheet, r, cDish);
      const componentSku = cellText(sheet, r, cComp);
      const quantity = cellNumber(sheet, r, cQty);
      if (!dishSku && !componentSku) continue;
      const values = {
        dishSku,
        componentSku,
        quantity: quantity ?? "",
      };
      if (!dishSku || !componentSku || quantity === null || quantity <= 0) {
        errorRows.push({
          row: r,
          error: "dishSku, componentSku and positive quantity required",
          values,
        });
        continue;
      }
      const list = groups.get(dishSku) ?? [];
      list.push({ dishSku, componentSku, quantity, row: r });
      groups.set(dishSku, list);
    }

    let created = 0;
    for (const [dishSku, lines] of groups) {
      const finished = await this.prisma.product.findFirst({
        where: { organizationId, sku: dishSku, deletedAt: null },
      });
      if (!finished) {
        for (const line of lines) {
          errorRows.push({
            row: line.row,
            error: `dish sku not found: ${dishSku}`,
            values: {
              dishSku,
              componentSku: line.componentSku,
              quantity: line.quantity,
            },
          });
        }
        continue;
      }
      if (assembled) {
        const existingRecipe = await this.prisma.productRecipe.findFirst({
          where: {
            organizationId,
            finishedProductId: finished.id,
            deletedAt: null,
          },
        });
        if (existingRecipe) {
          for (const line of lines) {
            errorRows.push({
              row: line.row,
              error: "already exists (dishSku) after assemble",
              values: {
                dishSku,
                componentSku: line.componentSku,
                quantity: line.quantity,
              },
            });
          }
          continue;
        }
      }

      const recipeLines: Array<{ componentProductId: string; quantityPerUnit: number }> =
        [];
      let failed = false;
      for (const line of lines) {
        const component = await this.prisma.product.findFirst({
          where: { organizationId, sku: line.componentSku, deletedAt: null },
        });
        if (!component) {
          errorRows.push({
            row: line.row,
            error: `component sku not found: ${line.componentSku}`,
            values: {
              dishSku,
              componentSku: line.componentSku,
              quantity: line.quantity,
            },
          });
          failed = true;
          break;
        }
        recipeLines.push({
          componentProductId: component.id,
          quantityPerUnit: line.quantity,
        });
      }
      if (failed) continue;

      try {
        await this.prisma.$transaction(async (tx) => {
          const recipe = await tx.productRecipe.upsert({
            where: { finishedProductId: finished.id },
            create: {
              organizationId,
              finishedProductId: finished.id,
              name: finished.name,
            },
            update: { name: finished.name, deletedAt: null },
          });
          await tx.productRecipeLine.deleteMany({ where: { recipeId: recipe.id } });
          await tx.productRecipeLine.createMany({
            data: recipeLines.map((l) => ({
              recipeId: recipe.id,
              componentProductId: l.componentProductId,
              quantityPerUnit: new Decimal(l.quantityPerUnit),
            })),
          });
        });
        created += 1;
      } catch (err) {
        for (const line of lines) {
          errorRows.push({
            row: line.row,
            error: err instanceof Error ? err.message : "failed",
            values: {
              dishSku,
              componentSku: line.componentSku,
              quantity: line.quantity,
            },
          });
        }
      }
    }

    return this.finishWithErrors("recipes", created, errorRows, [
      "dishSku",
      "componentSku",
      "quantity",
    ]);
  }

  private async uploadDraft(
    organizationId: string,
    userId: string | null,
    kind: MigrationDraftKindSlug,
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    const draftKind = draftSlugToEnum(kind);
    const { sheet, header } = await loadFirstSheet(file.buffer);
    const spec = TEMPLATE_SPECS[kind];
    const missing = spec.columns
      .map((c) => c.key)
      .filter((key) => colIndex(header, key) < 0);
    // Allow optional columns to be absent for some drafts — require first 2 required-ish
    if (missing.length === spec.columns.length) {
      throw new BadRequestException(`header must include template columns for ${kind}`);
    }

    const colMap = Object.fromEntries(
      spec.columns.map((c) => [c.key, colIndex(header, c.key)]),
    ) as Record<string, number>;

    const accepted: Array<{
      rowNumber: number;
      payload: Prisma.InputJsonValue;
      resolved: Prisma.InputJsonValue;
      error: string | null;
    }> = [];
    const errorRows: Array<{
      row: number;
      error: string;
      values: Record<string, string | number>;
    }> = [];

    for (let r = 2; r <= sheet.rowCount; r += 1) {
      const values: Record<string, string | number> = {};
      for (const col of spec.columns) {
        const idx = colMap[col.key] ?? -1;
        const raw =
          typeof col.sample === "number"
            ? cellNumber(sheet, r, idx)
            : cellText(sheet, r, idx);
        values[col.key] = raw ?? "";
      }
      const allEmpty = Object.values(values).every(
        (v) => v === "" || v === null || v === undefined,
      );
      if (allEmpty) continue;

      const parsed = this.parseDraftRow(kind, values);
      if (parsed.error) {
        errorRows.push({ row: r, error: parsed.error, values });
        accepted.push({
          rowNumber: r,
          payload: values as Prisma.InputJsonValue,
          resolved: {},
          error: parsed.error,
        });
        continue;
      }
      accepted.push({
        rowNumber: r,
        payload: parsed.payload,
        resolved: parsed.resolved,
        error: null,
      });
    }

    const createdCount = accepted.filter((a) => !a.error).length;
    const errorCount = accepted.filter((a) => a.error).length;

    const batch = await this.prisma.$transaction(async (tx) => {
      await tx.migrationDraftLine.deleteMany({
        where: {
          organizationId,
          batch: { organizationId, kind: draftKind, status: MigrationDraftStatus.DRAFT },
        },
      });
      await tx.migrationDraftBatch.deleteMany({
        where: {
          organizationId,
          kind: draftKind,
          status: MigrationDraftStatus.DRAFT,
        },
      });
      const created = await tx.migrationDraftBatch.create({
        data: {
          organizationId,
          kind: draftKind,
          status: MigrationDraftStatus.DRAFT,
          uploadedByUserId: userId,
          fileName: file.originalname ?? null,
          createdCount,
          errorCount,
        },
      });
      if (accepted.length) {
        await tx.migrationDraftLine.createMany({
          data: accepted.map((a) => ({
            organizationId,
            batchId: created.id,
            rowNumber: a.rowNumber,
            payload: a.payload,
            resolved: a.resolved,
            error: a.error,
          })),
        });
      }
      return created;
    });

    const result = await this.finishWithErrors(
      kind,
      createdCount,
      errorRows,
      spec.columns.map((c) => c.key),
    );
    return { ...result, batchId: batch.id };
  }

  private parseDraftRow(
    kind: MigrationDraftKindSlug,
    values: Record<string, string | number>,
  ): {
    error: string | null;
    payload: Prisma.InputJsonValue;
    resolved: Prisma.InputJsonValue;
  } {
    const str = (k: string) => String(values[k] ?? "").trim();
    const num = (k: string) => {
      const v = values[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      const n = Number(String(v).replace(",", ".").replace(/\s+/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    switch (kind) {
      case "stock": {
        const sku = str("sku");
        const warehouseCode = str("warehouseCode");
        const quantity = num("quantity");
        const costPrice = num("costPrice");
        if (!sku || !warehouseCode || quantity === null || costPrice === null) {
          return {
            error: "sku, warehouseCode, quantity, costPrice required",
            payload: values as Prisma.InputJsonValue,
            resolved: {},
          };
        }
        return {
          error: null,
          payload: { sku, warehouseCode, quantity, costPrice },
          resolved: {},
        };
      }
      case "cash-bank": {
        const accountCode = str("accountCode");
        const iban = str("iban");
        const amount = num("amount");
        if (!accountCode || amount === null) {
          return {
            error: "accountCode and amount required",
            payload: values as Prisma.InputJsonValue,
            resolved: {},
          };
        }
        return {
          error: null,
          payload: { accountCode, iban, amount },
          resolved: {},
        };
      }
      case "capital": {
        const accountCode = str("accountCode");
        const amount = num("amount");
        if (!accountCode || amount === null) {
          return {
            error: "accountCode and amount required",
            payload: values as Prisma.InputJsonValue,
            resolved: {},
          };
        }
        return {
          error: null,
          payload: { accountCode, amount },
          resolved: {},
        };
      }
      case "open-items": {
        const side = str("side").toLowerCase();
        const documentNumber = str("documentNumber");
        const documentDate = str("documentDate");
        const dueDate = str("dueDate");
        const voen = str("voen");
        const amount = num("amount");
        const accountCode = str("accountCode");
        if (
          (side !== "ar" && side !== "ap") ||
          !documentNumber ||
          !documentDate ||
          !voen ||
          amount === null ||
          !accountCode
        ) {
          return {
            error: "side(ar|ap), documentNumber, documentDate, voen, amount, accountCode required",
            payload: values as Prisma.InputJsonValue,
            resolved: {},
          };
        }
        return {
          error: null,
          payload: {
            side,
            documentNumber,
            documentDate,
            dueDate,
            voen,
            amount,
            accountCode,
          },
          resolved: {},
        };
      }
      case "advances": {
        const kindVal = str("kind").toLowerCase();
        const partyCode = str("partyCode");
        const stayRef = str("stayRef");
        const amount = num("amount");
        const accountCode = str("accountCode");
        if (
          (kindVal !== "guest_deposit" && kindVal !== "city_ledger") ||
          !partyCode ||
          amount === null ||
          !accountCode
        ) {
          return {
            error: "kind, partyCode, amount, accountCode required",
            payload: values as Prisma.InputJsonValue,
            resolved: {},
          };
        }
        return {
          error: null,
          payload: { kind: kindVal, partyCode, stayRef, amount, accountCode },
          resolved: {},
        };
      }
      case "hr-balances": {
        const cpEmploymentId = str("cpEmploymentId");
        const salaryDebt = num("salaryDebt");
        const vacationDays = num("vacationDays");
        const avgMonthlySalary = num("avgMonthlySalary");
        if (!cpEmploymentId) {
          return {
            error: "cpEmploymentId required",
            payload: values as Prisma.InputJsonValue,
            resolved: {},
          };
        }
        return {
          error: null,
          payload: {
            cpEmploymentId,
            salaryDebt: salaryDebt ?? 0,
            vacationDays: vacationDays ?? 0,
            avgMonthlySalary: avgMonthlySalary ?? null,
          },
          resolved: {},
        };
      }
      case "payroll-liabilities": {
        const liabilityKind = str("liabilityKind").toLowerCase();
        const allowed = ["income_tax", "dsmf", "medical", "accountable_advance"];
        const cpEmploymentId = str("cpEmploymentId");
        const amount = num("amount");
        const accountCode = str("accountCode");
        if (!allowed.includes(liabilityKind) || amount === null || !accountCode) {
          return {
            error: "liabilityKind, amount, accountCode required",
            payload: values as Prisma.InputJsonValue,
            resolved: {},
          };
        }
        return {
          error: null,
          payload: { liabilityKind, cpEmploymentId, amount, accountCode },
          resolved: {},
        };
      }
      case "fixed-assets": {
        const inventoryNumber = str("inventoryNumber");
        const name = str("name");
        const accountCode = str("accountCode");
        const originalCost = num("originalCost");
        const accumulatedDepreciation = num("accumulatedDepreciation");
        const method = str("method").toUpperCase() || "STRAIGHT_LINE";
        const remainingLifeMonths = num("remainingLifeMonths");
        const lastDepreciationYearMonth = str("lastDepreciationYearMonth");
        if (
          !inventoryNumber ||
          !name ||
          !accountCode ||
          originalCost === null ||
          remainingLifeMonths === null
        ) {
          return {
            error:
              "inventoryNumber, name, accountCode, originalCost, remainingLifeMonths required",
            payload: values as Prisma.InputJsonValue,
            resolved: {},
          };
        }
        return {
          error: null,
          payload: {
            inventoryNumber,
            name,
            accountCode,
            originalCost,
            accumulatedDepreciation: accumulatedDepreciation ?? 0,
            method,
            remainingLifeMonths,
            lastDepreciationYearMonth,
          },
          resolved: {},
        };
      }
      case "vat-register": {
        const direction = str("direction").toLowerCase();
        const period = str("period");
        const voen = str("voen");
        const documentNumber = str("documentNumber");
        const netAmount = num("netAmount");
        const vatAmount = num("vatAmount");
        if (
          (direction !== "purchase" && direction !== "sale") ||
          !period ||
          netAmount === null ||
          vatAmount === null
        ) {
          return {
            error: "direction, period, netAmount, vatAmount required",
            payload: values as Prisma.InputJsonValue,
            resolved: {},
          };
        }
        return {
          error: null,
          payload: {
            direction,
            period,
            voen,
            documentNumber,
            netAmount,
            vatAmount,
          },
          resolved: {},
        };
      }
      default:
        return {
          error: `unsupported draft ${kind}`,
          payload: values as Prisma.InputJsonValue,
          resolved: {},
        };
    }
  }

  private async finishWithErrors(
    kind: string,
    created: number,
    errorRows: Array<{
      row: number;
      error: string;
      values: Record<string, string | number>;
    }>,
    headers: string[],
  ): Promise<UploadResult> {
    let errorFileBase64: string | undefined;
    if (errorRows.length) {
      const buf = await buildErrorWorkbook({
        sheetName: kind,
        headers,
        rows: errorRows,
      });
      errorFileBase64 = buf.toString("base64");
    }
    return {
      kind,
      created,
      errors: errorRows.length,
      errorRows: errorRows.map((e) => ({ row: e.row, error: e.error })),
      errorFileBase64,
    };
  }
}
