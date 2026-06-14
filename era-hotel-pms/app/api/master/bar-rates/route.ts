import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listBarRates, bulkUpsertBarRates } from '@/lib/services/bar-rates.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';

const bulkSchema = z.object({
  ratePlanId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  from: z.coerce.date(),
  to: z.coerce.date(),
  amount: z.number().positive(),
  currencyCode: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    assertMasterDataRead(await getSessionFromHeaders());
    const params = new URL(request.url).searchParams;
    const from = params.get('from');
    const to = params.get('to');
    return jsonOk(
      serialize(
        await listBarRates({
          ratePlanId: params.get('ratePlanId') ?? undefined,
          roomTypeId: params.get('roomTypeId') ?? undefined,
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
        }),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    assertMasterDataWrite(await getSessionFromHeaders());
    const body = bulkSchema.parse(await request.json());
    return jsonOk(serialize(await bulkUpsertBarRates(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
