import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  getYearEndPreview,
  runYearEndAction,
} from '@/lib/services/night-audit-year-end.service';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    return jsonOk(serialize(await getYearEndPreview()));
  } catch (err) {
    return handleRouteError(err);
  }
}

const bodySchema = z.object({
  action: z.enum(['LAST_DAY', 'FIRST_DAY']),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const body = bodySchema.parse(await request.json());
    // Honest staged response (200): menu is live, posting not enabled yet.
    return jsonOk(serialize(await runYearEndAction(body.action)));
  } catch (err) {
    return handleRouteError(err);
  }
}
