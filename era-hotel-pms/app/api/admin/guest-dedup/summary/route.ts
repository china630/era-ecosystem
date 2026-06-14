import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getGuestDedupSummary, listDuplicateGroups } from '@/lib/services/guest-dedup.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const [summary, groups] = await Promise.all([
      getGuestDedupSummary(),
      listDuplicateGroups(100),
    ]);
    return jsonOk(serialize({ summary, groups }));
  } catch (err) {
    return handleRouteError(err);
  }
}
