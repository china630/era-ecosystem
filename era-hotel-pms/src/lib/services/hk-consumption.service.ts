import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { requestOrganizationId } from '@/lib/request-organization';
import {
  assertBusinessDayOpenForPosting,
  getCurrentBusinessDate,
} from '@/lib/services/business-date.service';

/** Open business day, plus the last closed day so a posted line can be reversed. */
export async function listHkConsumption() {
  const businessDate = await getCurrentBusinessDate();
  const rows = await prisma.hkConsumption.findMany({
    where: { businessDate },
    orderBy: { sku: 'asc' },
  });
  const closedRows = await prisma.hkConsumption.findMany({
    where: { businessDate: { not: businessDate } },
    orderBy: [{ businessDate: 'desc' }, { sku: 'asc' }],
  });
  const [legacyReversed, markers] = await Promise.all([
    prisma.hkConsumption.findMany({
      where: { reversesId: { not: null } },
      select: { reversesId: true },
    }),
    prisma.hkConsumptionReversal.findMany({ select: { sourceId: true } }),
  ]);
  const reversed = new Set<string>([
    ...legacyReversed.map((row) => row.reversesId).filter((id): id is string => Boolean(id)),
    ...markers.map((row) => row.sourceId),
  ]);
  return {
    businessDate: hotelDateKey(businessDate),
    lines: rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      qty: decimalToNumber(row.qty),
    })),
    closedLines: closedRows.map((row) => ({
      id: row.id,
      sku: row.sku,
      qty: decimalToNumber(row.qty),
      businessDate: hotelDateKey(row.businessDate),
      reversed: reversed.has(row.id),
    })),
  };
}

export async function saveHkConsumption(input: { sku: string; qty: number }) {
  await assertBusinessDayOpenForPosting();
  const sku = input.sku.trim();
  if (!sku) throw new Error('SKU is required');
  if (!Number.isFinite(input.qty) || input.qty === 0) {
    throw new Error('Quantity must be non-zero');
  }
  const organizationId = requestOrganizationId();
  const businessDate = await getCurrentBusinessDate();
  const qty = toDecimal(input.qty);
  const existing = await prisma.hkConsumption.findFirst({
    where: { businessDate, sku: { equals: sku, mode: 'insensitive' } },
  });
  if (existing) {
    return prisma.hkConsumption.update({
      where: { id: existing.id },
      data: { sku, qty },
    });
  }
  return prisma.hkConsumption.create({
    data: { organizationId, businessDate, sku, qty },
  });
}

/** Negative quantity on the open day. The closed line stays in history. */
export async function reverseHkConsumption(id: string) {
  await assertBusinessDayOpenForPosting();
  const businessDate = await getCurrentBusinessDate();
  const source = await prisma.hkConsumption.findFirst({ where: { id } });
  if (!source) throw new Error('Consumption line was not found');
  if (hotelDateKey(source.businessDate) === hotelDateKey(businessDate)) {
    throw new Error('Delete the open day line instead of reversing it');
  }
  const organizationId = requestOrganizationId();
  const marked = await prisma.hkConsumptionReversal.findFirst({ where: { sourceId: source.id } });
  if (marked) {
    const open = await prisma.hkConsumption.findFirst({ where: { id: marked.openLineId } });
    if (open) return open;
    await prisma.hkConsumptionReversal.delete({ where: { id: marked.id } });
  }
  const already = await prisma.hkConsumption.findFirst({ where: { reversesId: source.id } });
  if (already) return already;
  const delta = -decimalToNumber(source.qty);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.hkConsumption.findFirst({
      where: { businessDate, sku: { equals: source.sku, mode: 'insensitive' } },
    });
    const open = existing
      ? await tx.hkConsumption.update({
          where: { id: existing.id },
          data: {
            qty: toDecimal(decimalToNumber(existing.qty) + delta),
            reversesId: existing.reversesId ?? source.id,
          },
        })
      : await tx.hkConsumption.create({
          data: {
            organizationId,
            businessDate,
            sku: source.sku,
            qty: toDecimal(delta),
            reversesId: source.id,
          },
        });
    await tx.hkConsumptionReversal.create({
      data: { organizationId, sourceId: source.id, openLineId: open.id },
    });
    return open;
  });
}

export async function deleteHkConsumption(id: string) {
  await assertBusinessDayOpenForPosting();
  const businessDate = await getCurrentBusinessDate();
  const row = await prisma.hkConsumption.findFirst({ where: { id, businessDate } });
  if (!row) throw new Error('Consumption line is not on the open business day');
  await prisma.$transaction([
    prisma.hkConsumptionReversal.deleteMany({ where: { openLineId: row.id } }),
    prisma.hkConsumption.delete({ where: { id: row.id } }),
  ]);
}
