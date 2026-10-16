import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { voidFolioPayment } from '@/lib/services/folio.service';

const bodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_VOID);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await request.json());
    const updated = await voidFolioPayment({
      paymentId: id,
      reason: body.reason,
      audit: { userId: session?.sub, request },
    });
    return jsonOk(serialize(updated));
  } catch (err) {
    return handleRouteError(err);
  }
}
