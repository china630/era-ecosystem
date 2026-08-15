import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { checkoutReservation } from '@/lib/services/checkout.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const bodySchema = z
  .object({
    transferToCityLedger: z.boolean().optional(),
    discountAmount: z.number().positive().optional(),
    discountDescription: z.string().max(200).optional(),
  })
  .optional();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKOUT);
    const { id } = await params;
    let opts: z.infer<typeof bodySchema> = undefined;
    try {
      const raw = await request.json();
      opts = bodySchema.parse(raw);
    } catch {
      opts = undefined;
    }
    const result = await checkoutReservation(id, opts ?? undefined);
    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
