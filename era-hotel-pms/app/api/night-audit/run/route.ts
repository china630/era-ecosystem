import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { runNightAudit } from '@/lib/services/night-audit.service';
import {
  QaimeDayCloseBlockedError,
  QaimeDayCloseUnreachableError,
} from '@/lib/services/qaime-day-close-gate';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const result = await runNightAudit({ userId: session?.sub, request });
    return jsonOk(serialize(result));
  } catch (err) {
    if (err instanceof QaimeDayCloseBlockedError) {
      return Response.json(
        { error: err.message, code: err.code, gaps: err.gaps },
        { status: err.status },
      );
    }
    if (err instanceof QaimeDayCloseUnreachableError) {
      return Response.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return handleRouteError(err);
  }
}
