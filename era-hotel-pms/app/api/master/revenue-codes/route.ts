import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { PAYMENT_CATEGORIES } from '@/lib/payment-category';
import { createRevenueCode, listRevenueCodes } from '@/lib/services/master-data.service';
import { scheduleMasterDataSyncDebounced } from '@/lib/integration/master-data-sync-debounce';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  ...localizedNameFields,
  taxTag: z.string().optional(),
  departmentId: z.string().uuid(),
  targetFolioType: z.enum(['GUEST', 'COMPANY', 'AGENCY']).optional(),
  allowManualCharge: z.boolean().optional(),
  allowManualPayment: z.boolean().optional(),
  reportType: z.string().max(32).nullable().optional(),
  paymentCategory: z.enum(PAYMENT_CATEGORIES).nullable().optional(),
});

export async function GET() {
  try {
    assertMasterDataRead(await getSatelliteSession());
    return jsonOk(serialize(await listRevenueCodes()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertMasterDataWrite(await getSatelliteSession());
    const body = schema.parse(await request.json());
    const created = await createRevenueCode(body);
    scheduleMasterDataSyncDebounced();
    return jsonOk(serialize(created), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
