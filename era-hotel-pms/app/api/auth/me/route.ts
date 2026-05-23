import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { userPermissions } from '@/lib/services/user.service';
import { permissionsForRole } from '@/lib/auth/permissions';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    if (!session) return jsonError('Unauthorized', 401);

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { role: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      return jsonError('Unauthorized', 401);
    }

    return jsonOk({
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role.code,
      department: user.department,
      permissions: userPermissions(user),
      rolePermissions: permissionsForRole(user.role.code),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
