import { todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createCommissionBatch } from '@/lib/services/agency-commission.service';

const schema = z.object({
  agencyId: z.string().min(1),
  periodFrom: z.string().min(8).optional(),
  periodTo: z.string().min(8).optional(),
  lineIds: z.array(z.string().min(1)).optional(),
});

export async function POST(request: Request) {
  try {
    assertPermission(await getSatelliteSession(), PERMISSIONS.MASTER_DATA_MANAGE);
    const body = schema.parse(await request.json());
    const from = body.periodFrom ?? todayBakuYmd();
    const to = body.periodTo ?? from;
    const batch = await createCommissionBatch({
      agencyId: body.agencyId,
      periodFromYmd: from,
      periodToYmd: to,
      lineIds: body.lineIds,
    });
    return jsonOk(serialize(batch));
  } catch (err) {
    return handleRouteError(err);
  }
}
