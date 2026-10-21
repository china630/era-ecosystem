import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { previewNightAudit } from '@/lib/services/night-audit.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    return jsonOk(serialize(await previewNightAudit()));
  } catch (err) {
    return handleRouteError(err);
  }
}
