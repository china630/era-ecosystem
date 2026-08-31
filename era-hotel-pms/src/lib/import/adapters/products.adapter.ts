import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellBool, cellNumber, cellString, slugCode } from '@/lib/import/helpers';
import { toDecimal } from '@/lib/decimal';
import type { ImportAdapter, ImportTx } from '@/lib/import/types';

const rowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  groupName: z.string().optional().nullable(),
  unit: z.string().optional(),
  price: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  revenueGroup: z.string().optional().nullable(),
  vatRate: z.number().optional().nullable(),
  active: z.boolean().optional(),
});

type ProductRow = z.infer<typeof rowSchema>;

async function ensureProductGroup(
  tx: ImportTx,
  name: string | null | undefined,
  dryRun: boolean,
): Promise<string | null> {
  if (!name) return null;
  const code = slugCode(name);
  const existing = await tx.productGroup.findFirst({ where: { code } });
  if (dryRun && !existing) return null;
  const group = await tx.productGroup.upsert({
    where: { code } as never,
    create: { code, name },
    update: { name },
  });
  return group.id;
}

function buildProductAdapter(
  entity: string,
  label: string,
  order: number,
  templateHint: string,
  productType: 'SELLABLE' | 'STOCK',
): ImportAdapter<ProductRow> {
  return {
    entity,
    label,
    order,
    permission: PERMISSIONS.MASTER_DATA_MANAGE,
    templateHint,
    headerAliases: {
      Id: 'ewId',
      'Product Code': 'code',
      'Stock Code': 'code',
      'Ürün Kodu': 'code',
      'Stok Kodu': 'code',
      'Product Name': 'name',
      'Stock Name': 'name',
      'Ürün Adı': 'name',
      'Stok Adı': 'name',
      'Product Group Name': 'groupName',
      'Stock Group': 'groupName',
      'Ürün Grubu Adı': 'groupName',
      'Stock Unit': 'unit',
      Price: 'price',
      Fiyat: 'price',
      Currency: 'currency',
      Döviz: 'currency',
      'Revenue Group': 'revenueGroup',
      'Gelir Grubu': 'revenueGroup',
      Vat: 'vatRate',
      KDV: 'vatRate',
      'Discount Active': 'active',
      'İndirim Aktif': 'active',
    },
    rowSchema,
    mapRow: (raw) => {
      const name = cellString(raw.name);
      if (!name) return null;
      const ewId = cellString(raw.ewId) ?? (raw.ewId != null ? String(raw.ewId) : null);
      const prefix = productType === 'STOCK' ? 'ERA-STK' : 'ERA-FNB';
      return {
        code: cellString(raw.code) ?? (ewId ? `${prefix}-${ewId}` : slugCode(name)),
        name,
        groupName: cellString(raw.groupName),
        unit: cellString(raw.unit) ?? 'pcs',
        price: cellNumber(raw.price),
        currency: cellString(raw.currency),
        revenueGroup: cellString(raw.revenueGroup),
        vatRate: cellNumber(raw.vatRate),
        active: raw.active === undefined ? true : cellBool(raw.active),
      };
    },
    upsert: async (tx, row, dryRun) => {
      const groupId = await ensureProductGroup(tx, row.groupName, dryRun);
      const existing = await tx.product.findFirst({ where: { code: row.code } });
      const data = {
        name: row.name,
        productType,
        groupId: groupId ?? undefined,
        unit: row.unit ?? 'pcs',
        price: row.price != null ? toDecimal(row.price) : undefined,
        currency: row.currency ?? undefined,
        revenueGroup: row.revenueGroup ?? undefined,
        vatRate: row.vatRate != null ? toDecimal(row.vatRate) : undefined,
        active: row.active ?? true,
      };
      if (dryRun) return existing ? 'updated' : 'created';
      await tx.product.upsert({
        where: { code: row.code } as never,
        create: { code: row.code, ...data },
        update: data,
      });
      return existing ? 'updated' : 'created';
    },
  };
}

export const productCardsAdapter = buildProductAdapter(
  'product-cards',
  'Product Cards',
  31,
  '31-Product-Cards.xlsx — EW Ürün Kartları',
  'SELLABLE',
);

export const stockCardsAdapter = buildProductAdapter(
  'stock-cards',
  'Stock Cards',
  32,
  '33-Stock-Cards.xlsx — EW Ürün Tanımları / Stock Cards',
  'STOCK',
);
