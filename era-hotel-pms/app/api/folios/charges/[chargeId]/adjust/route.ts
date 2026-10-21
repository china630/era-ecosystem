import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { postFolioAdjustment } from '@/lib/services/folio.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const bodySchema = z.object({
  amount: z.number().refine((value) => Number.isFinite(value) && value !== 0, 'Amount must be non-zero'),
  reason: z.string().trim().min(1).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chargeId: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_CHARGE);
    const { chargeId } = await params;
    const body = bodySchema.parse(await request.json());
    const result = await postFolioAdjustment({
      chargeId,
      amount: body.amount,
      reason: body.reason,
      audit: { userId: session?.sub, request },
    });
    return jsonOk(serialize(result));
  } catch (err) {
    return handleRouteError(err);
  }
}
