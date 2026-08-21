import { prisma } from '@/lib/prisma';
import { toDecimal, decimalToNumber } from '@/lib/decimal';

export async function listWarehouses() {
  return prisma.warehouse.findMany({ orderBy: { code: 'asc' } });
}

export async function listProducts() {
  return prisma.product.findMany({
    include: { group: true, recipe: { include: { lines: { include: { ingredient: true } } } } },
    orderBy: { code: 'asc' },
  });
}

export async function createProduct(input: {
  code: string;
  name: string;
  productType?: 'SELLABLE' | 'STOCK';
  groupId?: string;
  unit?: string;
  price?: number;
  currency?: string;
  vatRate?: number;
}) {
  return prisma.product.create({
    data: {
      code: input.code,
      name: input.name,
      productType: input.productType ?? 'STOCK',
      groupId: input.groupId,
      unit: input.unit ?? 'pcs',
      price: input.price != null ? toDecimal(input.price) : undefined,
      currency: input.currency,
      vatRate: input.vatRate != null ? toDecimal(input.vatRate) : undefined,
    },
    include: { group: true },
  });
}

export async function updateProduct(
  id: string,
  input: {
    name?: string;
    productType?: 'SELLABLE' | 'STOCK';
    groupId?: string | null;
    unit?: string;
    price?: number | null;
    currency?: string | null;
    vatRate?: number | null;
    active?: boolean;
  },
) {
  return prisma.product.update({
    where: { id },
    data: {
      name: input.name,
      productType: input.productType,
      groupId: input.groupId === null ? null : input.groupId,
      unit: input.unit,
      price: input.price != null ? toDecimal(input.price) : input.price === null ? null : undefined,
      currency: input.currency === null ? null : input.currency,
      vatRate: input.vatRate != null ? toDecimal(input.vatRate) : input.vatRate === null ? null : undefined,
      active: input.active,
    },
    include: { group: true },
  });
}

export async function createWarehouse(input: { code: string; name: string }) {
  return prisma.warehouse.create({ data: input });
}

export async function getStockBalance(productId: string, warehouseId: string) {
  const movements = await prisma.stockMovement.findMany({
    where: { productId, warehouseId },
  });
  let balance = 0;
  for (const m of movements) {
    const q = decimalToNumber(m.qty);
    if (m.type === 'RECEIPT') balance += q;
    else if (m.type === 'ISSUE') balance -= q;
    else if (m.type === 'TRANSFER') balance += q;
  }
  return balance;
}

export async function postStockMovement(input: {
  productId: string;
  warehouseId: string;
  type: 'RECEIPT' | 'ISSUE' | 'TRANSFER';
  qty: number;
  reference?: string;
}) {
  if (input.type === 'ISSUE') {
    const bal = await getStockBalance(input.productId, input.warehouseId);
    if (bal < input.qty && process.env.STOCK_ALLOW_NEGATIVE !== 'true') {
      throw new Error(`Insufficient stock (balance ${bal})`);
    }
  }
  return prisma.stockMovement.create({
    data: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: input.type,
      qty: toDecimal(input.qty),
      reference: input.reference,
    },
    include: { product: true, warehouse: true },
  });
}

export async function consumeRecipeForProduct(productCode: string, portions = 1) {
  const product = await prisma.product.findFirst({
    where: { code: productCode },
    include: { recipe: { include: { lines: true } } },
  });
  if (!product?.recipe) return;

  const warehouse = await prisma.warehouse.findFirst({ orderBy: { code: 'asc' } });
  if (!warehouse) return;

  for (const line of product.recipe.lines) {
    await postStockMovement({
      productId: line.ingredientProductId,
      warehouseId: warehouse.id,
      type: 'ISSUE',
      qty: decimalToNumber(line.qty) * portions,
      reference: `POS sale ${productCode}`,
    });
  }
}
