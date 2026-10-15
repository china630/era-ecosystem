import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getGuestDedupSummary, listDuplicateGroups } from '@/lib/services/guest-dedup.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const [summary, groups] = await Promise.all([
      getGuestDedupSummary(),
      listDuplicateGroups(200),
    ]);
    const guestIds = new Set(groups.flatMap((group) => group.guestIds));
    return jsonOk(
      serialize({
        summary: {
          ...summary,
          suspectedDuplicateGroups: groups.length,
          suspectedDuplicateGuests: guestIds.size,
        },
        groups,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
