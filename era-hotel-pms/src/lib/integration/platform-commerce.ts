import { runPlatformCommerceHooks } from '@era/satellite-kit';

export type HotelFolioHookInput = {
  folioId: string;
  amountAzn: number;
  sourceEntityType: string;
  sourceEntityId: string;
  description?: string;
  guestPhone?: string | null;
};

/** Platform CP hooks for folio payment, invoice, room charge (pre-GA G1). */
export async function runHotelFolioPlatformHooks(
  input: HotelFolioHookInput,
): Promise<{ payUrl?: string }> {
  const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? '';
  if (!organizationId || input.amountAzn <= 0) return {};

  return runPlatformCommerceHooks({
    organizationId,
    portal: { entityType: 'folio', entityId: input.folioId },
    payment: {
      amountAzn: input.amountAzn,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      description: input.description,
    },
    delivery: {
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      externalRef: input.folioId,
      recipientPhone: input.guestPhone?.trim() || undefined,
    },
    loyalty: {
      code: `HOTEL-${input.sourceEntityId.slice(0, 8)}`,
      name: 'Hotel folio promotion',
      discountValue: 5,
      metadata: { folioId: input.folioId },
    },
  });
}
