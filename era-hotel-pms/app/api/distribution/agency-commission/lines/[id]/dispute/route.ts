import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { disputeCommissionLine } from '@/lib/services/agency-commission.service';

const schema = z.object({
  reason: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertPermission(await getSatelliteSession(), PERMISSIONS.MASTER_DATA_MANAGE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await disputeCommissionLine(id, body.reason)));
  } catch (err) {
    return handleRouteError(err);
  }
}
