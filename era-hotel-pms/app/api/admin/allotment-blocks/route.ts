import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  createAllotmentBlock,
  listAllotmentBlocks,
} from '@/lib/services/allotment-block.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { requireHotelModule } from '@/lib/hotel-module-gate';

const lineSchema = z.object({
  roomTypeId: z.string().uuid(),
  quantity: z.number().int().positive(),
  ratePlanId: z.string().uuid().optional().nullable(),
});

const createSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().optional(),
  status: z.enum(['TENTATIVE', 'DEFINITE', 'CANCELLED', 'RELEASED']).optional(),
  agencyId: z.string().uuid().optional(),
  salesContractId: z.string().uuid().optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
  cutoffDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

export async function GET(req: Request) {
  try {
    await requireHotelModule('hotel_distribution');
    assertMasterDataRead(await getSessionFromHeaders());
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as
      | 'TENTATIVE'
      | 'DEFINITE'
      | 'CANCELLED'
      | 'RELEASED'
      | null;
    const agencyId = url.searchParams.get('agencyId') ?? undefined;
    return jsonOk(
      serialize(
        await listAllotmentBlocks({
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
    const row = await createAllotmentBlock(body);
    return jsonOk(serialize(row), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
