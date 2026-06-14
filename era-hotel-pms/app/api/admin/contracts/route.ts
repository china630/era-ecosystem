import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  createSalesContract,
  listSalesContracts,
} from '@/lib/services/sales-contract.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { requireHotelModule } from '@/lib/hotel-module-gate';

const createSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1),
  counterpartyType: z.enum(['AGENCY', 'CORPORATE']).optional(),
  agencyId: z.string().uuid().optional(),
  companyGuestId: z.string().uuid().optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  ratePlanId: z.string().uuid(),
  minStay: z.number().int().positive().optional(),
  cta: z.boolean().optional(),
  ctd: z.boolean().optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  depositRequired: z.boolean().optional(),
  depositAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  externalRef: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    await requireHotelModule('hotel_distribution');
    assertMasterDataRead(await getSessionFromHeaders());
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as
      | 'DRAFT'
      | 'ACTIVE'
      | 'EXPIRED'
      | 'CANCELLED'
      | null;
    const agencyId = url.searchParams.get('agencyId') ?? undefined;
    return jsonOk(
      serialize(
        await listSalesContracts({
          status: status ?? undefined,
          agencyId,
        }),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireHotelModule('hotel_distribution');
    assertMasterDataWrite(await getSessionFromHeaders());
    const body = createSchema.parse(await request.json());
    const created = await createSalesContract(body);
    return jsonOk(serialize(created), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
