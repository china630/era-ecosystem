import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  applyStayPercent,
  spreadManualNightly,
  spreadStayTotal,
} from '@/lib/services/reservation-pricing.service';

const schema = z.object({
  kind: z.enum(['NIGHTLY', 'STAY_TOTAL', 'PERCENT']),
  value: z.number(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    if (body.kind === 'NIGHTLY') {
      return jsonOk(serialize(await spreadManualNightly(id, body.value)));
    }
    if (body.kind === 'STAY_TOTAL') {
      return jsonOk(serialize(await spreadStayTotal(id, body.value)));
    }
    return jsonOk(serialize(await applyStayPercent(id, body.value)));
  } catch (err) {
    return handleRouteError(err);
  }
}
