import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  listMissedRoomNights,
  postMissedRoomNights,
} from '@/lib/services/missed-room-nights.service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertAnyPermission(session, [PERMISSIONS.FOLIO_CHARGE, PERMISSIONS.NIGHT_AUDIT_RUN]);
    const { id } = await params;
    return jsonOk(serialize(await listMissedRoomNights(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertAnyPermission(session, [PERMISSIONS.FOLIO_CHARGE, PERMISSIONS.NIGHT_AUDIT_RUN]);
    const { id } = await params;
    return jsonOk(serialize(await postMissedRoomNights(id, session?.sub)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
