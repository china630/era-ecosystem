import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';
import { requestOrganizationId } from '@/lib/request-organization';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';

export async function recordInternalConsumption(input: {
  businessDate: string;
  sku: string;
  qty: number;
  warehouseCode?: string | null;
  source: string;
  sourceRef: string;
}) {
  const sourceRef = input.sourceRef.trim();
  const sku = input.sku.trim();
  if (!sourceRef) throw new Error('sourceRef is required');
  if (!sku) throw new Error('sku is required');
  if (!Number.isFinite(input.qty) || input.qty === 0) throw new Error('qty must be non-zero');
  const existing = await prisma.internalConsumption.findUnique({ where: { sourceRef } });
  if (existing) return existing;

  let businessDate = bakuCivilUtcDate(input.businessDate);
  const posted = await prisma.businessDay.findFirst({ where: { date: businessDate } });
  if (posted?.status === 'CLOSED') {
    businessDate = await getCurrentBusinessDate();
  }
  const organizationId = requestOrganizationId();
  if (!organizationId) throw new Error('organizationId required');
  return prisma.internalConsumption.create({
    data: {
      organizationId,
      businessDate,
      sku,
      qty: toDecimal(input.qty),
      warehouseCode: input.warehouseCode?.trim() || null,
      source: input.source.trim() || 'clinic',
      sourceRef,
    },
  });
}
