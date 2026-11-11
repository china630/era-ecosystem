/** Nafta guest laundry blank — wash/iron null means service not offered. */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type LaundryCatalogSeedRow = {
  code: string;
  category: 'MEN' | 'WOMEN' | 'CHILD';
  nameAz: string;
  nameEn: string;
  nameRu: string;
  washPrice: number | null;
  ironPrice: number | null;
};

export const NAFTA_LAUNDRY_CATALOG: LaundryCatalogSeedRow[] = [
  { code: 'M-SUIT', category: 'MEN', nameAz: 'Kostyum', nameEn: 'Suit', nameRu: 'Костюм', washPrice: null, ironPrice: 4 },
  { code: 'M-JACKET', category: 'MEN', nameAz: 'Pencək', nameEn: 'Jacket', nameRu: 'Пиджак', washPrice: null, ironPrice: 3 },
  { code: 'M-TROUSERS', category: 'MEN', nameAz: 'Şalvar', nameEn: 'Trousers', nameRu: 'Брюки', washPrice: 4, ironPrice: 3 },
  { code: 'M-COAT', category: 'MEN', nameAz: 'Palto', nameEn: 'Coat', nameRu: 'Пальто', washPrice: null, ironPrice: 6 },
  { code: 'M-PULLOVER', category: 'MEN', nameAz: 'Sviter', nameEn: 'Pullover', nameRu: 'Свитер', washPrice: 4, ironPrice: 3 },
  { code: 'M-SHIRT', category: 'MEN', nameAz: 'Köynək', nameEn: 'Shirt', nameRu: 'Рубашка', washPrice: 4, ironPrice: 3 },
  { code: 'M-TEE', category: 'MEN', nameAz: 'Qısaqol köynək', nameEn: 'T-shirt', nameRu: 'Футболка', washPrice: 3, ironPrice: 2 },
  { code: 'M-VEST', category: 'MEN', nameAz: 'Mayka', nameEn: 'Vest', nameRu: 'Майка', washPrice: 3, ironPrice: null },
  { code: 'M-PYJAMAS', category: 'MEN', nameAz: 'Pijama', nameEn: 'Pyjamas', nameRu: 'Пижама', washPrice: 4, ironPrice: null },
  { code: 'M-SOCKS', category: 'MEN', nameAz: 'Corab', nameEn: 'Socks', nameRu: 'Носки', washPrice: 0.5, ironPrice: null },
  { code: 'M-UNDERWEAR', category: 'MEN', nameAz: 'Alt paltarı', nameEn: 'Underwear', nameRu: 'Нижнее белье', washPrice: 1, ironPrice: null },
  { code: 'M-SHORTS', category: 'MEN', nameAz: 'Şortik', nameEn: 'Shorts', nameRu: 'Шорты', washPrice: 2, ironPrice: null },
  { code: 'M-SPORT', category: 'MEN', nameAz: 'İdman dəsti', nameEn: 'Sport suit', nameRu: 'Спортивный костюм', washPrice: 5, ironPrice: null },

  { code: 'W-SUIT', category: 'WOMEN', nameAz: 'Kostyum', nameEn: 'Suit', nameRu: 'Костюм', washPrice: null, ironPrice: 4 },
  { code: 'W-EVENING', category: 'WOMEN', nameAz: 'Gecə donu', nameEn: 'Evening dress', nameRu: 'Вечернее платье', washPrice: null, ironPrice: 11 },
  { code: 'W-JACKET', category: 'WOMEN', nameAz: 'Jaket', nameEn: 'Jacket', nameRu: 'Жакет', washPrice: null, ironPrice: 4 },
  { code: 'W-SKIRT', category: 'WOMEN', nameAz: 'Yubka', nameEn: 'Skirt', nameRu: 'Юбка', washPrice: 5, ironPrice: 3 },
  { code: 'W-TROUSERS', category: 'WOMEN', nameAz: 'Şalvar', nameEn: 'Trousers', nameRu: 'Брюки', washPrice: 5, ironPrice: 3 },
  { code: 'W-PULLOVER', category: 'WOMEN', nameAz: 'Sviter', nameEn: 'Pullover', nameRu: 'Свитер', washPrice: 4, ironPrice: 3 },
  { code: 'W-SILK-DRESS', category: 'WOMEN', nameAz: 'İpək don', nameEn: 'Silk dress', nameRu: 'Платье (шелк)', washPrice: null, ironPrice: 11 },
  { code: 'W-SILK-BLOUSE', category: 'WOMEN', nameAz: 'İpək bluzka', nameEn: 'Silk blouse', nameRu: 'Блузка (шелк)', washPrice: null, ironPrice: 5 },
  { code: 'W-TEE', category: 'WOMEN', nameAz: 'Qısaqol köynək', nameEn: 'T-shirt', nameRu: 'Футболка', washPrice: 3, ironPrice: 2 },
  { code: 'W-BRA', category: 'WOMEN', nameAz: 'Büsthalter', nameEn: 'Bra', nameRu: 'Бюстгальтер', washPrice: 2, ironPrice: null },
  { code: 'W-SCARF', category: 'WOMEN', nameAz: 'Şarf', nameEn: 'Scarf', nameRu: 'Шарф', washPrice: 2, ironPrice: 2 },
  { code: 'W-UNDERWEAR', category: 'WOMEN', nameAz: 'Alt paltarı', nameEn: 'Underwear', nameRu: 'Нижнее белье', washPrice: 1, ironPrice: null },
  { code: 'W-PYJAMAS', category: 'WOMEN', nameAz: 'Pijama', nameEn: 'Pyjamas', nameRu: 'Пижама', washPrice: 5, ironPrice: null },
  { code: 'W-SPORT', category: 'WOMEN', nameAz: 'İdman dəsti', nameEn: 'Sport suit', nameRu: 'Спортивный костюм', washPrice: 5, ironPrice: null },
  { code: 'W-SHIRT', category: 'WOMEN', nameAz: 'Köynək', nameEn: 'Shirt', nameRu: 'Рубашка', washPrice: 4, ironPrice: null },
  { code: 'W-DRESS', category: 'WOMEN', nameAz: 'Don', nameEn: 'Dress', nameRu: 'Платье', washPrice: 10, ironPrice: 5 },

  { code: 'C-SUIT', category: 'CHILD', nameAz: 'Kostyum', nameEn: 'Suit', nameRu: 'Костюм', washPrice: 2, ironPrice: 1 },
  { code: 'C-TROUSERS', category: 'CHILD', nameAz: 'Şalvar', nameEn: 'Trousers', nameRu: 'Брюки', washPrice: 2, ironPrice: 1 },
  { code: 'C-PULLOVER', category: 'CHILD', nameAz: 'Sviter', nameEn: 'Pullover', nameRu: 'Свитер', washPrice: 2, ironPrice: 1 },
  { code: 'C-UNDERWEAR', category: 'CHILD', nameAz: 'Alt paltarı', nameEn: 'Underwear', nameRu: 'Нижнее белье', washPrice: 1, ironPrice: null },
  { code: 'C-VEST', category: 'CHILD', nameAz: 'Mayka', nameEn: 'Vest', nameRu: 'Майка', washPrice: 1, ironPrice: null },
  { code: 'C-PYJAMAS', category: 'CHILD', nameAz: 'Pijama', nameEn: 'Pyjamas', nameRu: 'Пижама', washPrice: 2, ironPrice: null },
  { code: 'C-SOCKS', category: 'CHILD', nameAz: 'Corab', nameEn: 'Socks', nameRu: 'Носки', washPrice: 0.5, ironPrice: null },
];

export function laundryItemDisplayName(
  item: {
    name?: string | null;
    nameAz?: string | null;
    nameRu?: string | null;
    nameEn?: string | null;
  },
  locale?: string | null,
): string {
  const loc = (locale ?? 'en').slice(0, 2).toLowerCase();
  if (loc === 'az' && item.nameAz?.trim()) return item.nameAz.trim();
  if (loc === 'ru' && item.nameRu?.trim()) return item.nameRu.trim();
  if (item.nameEn?.trim()) return item.nameEn.trim();
  return item.name?.trim() || '—';
}

export function pickLaundryUnitPrices(
  item: {
    washPrice?: number | string | null;
    ironPrice?: number | string | null;
    expressWashPrice?: number | string | null;
    expressIronPrice?: number | string | null;
  },
  express: boolean,
): { washPrice: number | null; ironPrice: number | null; missingExpress: boolean } {
  const asNum = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  if (!express) {
    return {
      washPrice: asNum(item.washPrice),
      ironPrice: asNum(item.ironPrice),
      missingExpress: false,
    };
  }
  const wash = asNum(item.expressWashPrice);
  const iron = asNum(item.expressIronPrice);
  return {
    washPrice: wash,
    ironPrice: iron,
    missingExpress: wash == null && iron == null,
  };
}

export async function listLaundryCatalogItems() {
  return prisma.laundryItem.findMany({ orderBy: [{ category: 'asc' }, { code: 'asc' }] });
}

export async function findLaundryCatalogItem(id: string) {
  return prisma.laundryItem.findUnique({ where: { id } });
}

export async function createLaundryCatalogItem(
  data: Omit<Prisma.LaundryItemCreateInput, "organization" | "organizationId">,
) {
  return prisma.laundryItem.create({ data: data as Prisma.LaundryItemCreateInput });
}

export async function updateLaundryCatalogItem(id: string, data: Prisma.LaundryItemUpdateInput) {
  return prisma.laundryItem.update({ where: { id }, data });
}
