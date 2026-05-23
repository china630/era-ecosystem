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
  groupId?: string;
  unit?: string;
}) {
  return prisma.product.create({ data: input });
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
  const product = await prisma.product.findUnique({
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
