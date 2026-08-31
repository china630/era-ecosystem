import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requestOrganizationId } from "@/lib/request-organization";
import { cellBool, cellNumber, cellString, slugCode } from "@/lib/import/helpers";
import type { ImportAdapter, ImportEntityMeta } from "@/lib/import/types";

const rowSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().nullable().optional(),
  description: z.string().min(1),
  unitPrice: z.number(),
});

export const stockCardsAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: "stock-cards",
  label: "Stock cards",
  order: 33,
  templateHint: "33-Stock-Cards.xlsx — EW Ürün Tanımları / Stock Cards",
  headerAliases: {
    Id: "ewId",
    "Ürün Kodu": "code",
    "Stok Kodu": "code",
    "Ürün Adı": "name",
    "Stok Adı": "name",
    Fiyat: "price",
    Barkod: "barcode",
    Pasif: "passive",
  },
  rowSchema,
  mapRow: (raw) => {
    const name = cellString(raw.name);
    if (!name) return null;
    if (cellBool(raw.passive)) return null;
    const ewId = cellString(raw.ewId) ?? (raw.ewId != null ? String(raw.ewId) : null);
    return {
      sku: cellString(raw.code) ?? (ewId ? `ERA-STK-${ewId}` : slugCode(name)),
      barcode: cellString(raw.barcode),
      description: name,
      unitPrice: cellNumber(raw.price) ?? 0,
    };
  },
  upsert: async (tx, row, dryRun) => {
    const orgId = requestOrganizationId();
    const existing = await tx.productCache.findFirst({ where: { sku: row.sku } });
    if (dryRun) return existing ? "updated" : "created";
    const data = {
      barcode: row.barcode ?? undefined,
      description: row.description,
      unitPrice: new Prisma.Decimal(row.unitPrice),
    };
    if (!existing) {
      await tx.productCache.create({
        data: { organizationId: orgId, sku: row.sku, ...data },
      });
      return "created";
    }
    await tx.productCache.update({ where: { id: existing.id }, data });
    return "updated";
  },
};

const ADAPTERS = [stockCardsAdapter] as ImportAdapter<unknown>[];

export function getImportAdapter(entity: string) {
  return ADAPTERS.find((a) => a.entity === entity);
}

export function listImportEntities(): ImportEntityMeta[] {
  return ADAPTERS.map(({ entity, label, order, templateHint, fileless, allowMultiple }) => ({
    entity,
    label,
    order,
    templateHint,
    fileless,
    allowMultiple,
  })).sort((a, b) => a.order - b.order);
}
