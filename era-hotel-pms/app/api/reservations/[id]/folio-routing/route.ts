import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  getReservationFolioRouting,
  upsertReservationFolioRouting,
} from '@/lib/services/reservation-submodals.service';

const putSchema = z.object({
  overrides: z.array(
    z.object({
      revenueCodeId: z.string().uuid(),
      targetFolioType: z.enum(['GUEST', 'COMPANY', 'AGENCY']),
    }),
  ),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = await params;
    return jsonOk(serialize(await getReservationFolioRouting(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_CHARGE);
    const { id } = await params;
    const body = putSchema.parse(await request.json());
    return jsonOk(serialize(await upsertReservationFolioRouting(id, body.overrides)));
  } catch (err) {
    return handleRouteError(err);
  }
}
