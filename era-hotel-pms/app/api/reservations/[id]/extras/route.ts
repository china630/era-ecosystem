import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { addQuickCharge, getReservation } from '@/lib/services/reservation.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  revenueCodeId: z.string().uuid(),
  amount: z.number().positive(),
  qty: z.number().int().positive().optional(),
  description: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_CHARGE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const charge = await addQuickCharge(id, body);
    const reservation = await getReservation(id);
    return jsonOk(serialize({ charge, reservation }));
  } catch (err) {
    return handleRouteError(err);
  }
}
