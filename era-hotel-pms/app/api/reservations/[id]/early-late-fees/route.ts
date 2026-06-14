import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { previewEarlyLateFees } from '@/lib/services/early-late-fees.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    const q = new URL(request.url).searchParams;
    return jsonOk(
      serialize(
        await previewEarlyLateFees(id, {
          checkInTime: q.get('checkInTime') ?? undefined,
          checkOutTime: q.get('checkOutTime') ?? undefined,
        }),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
