import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.USERS_MANAGE);
    const roles = await prisma.role.findMany({ orderBy: { code: 'asc' } });
    return jsonOk(serialize(roles));
  } catch (err) {
    return handleRouteError(err);
  }
}
