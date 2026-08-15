import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { userPermissions } from '@/lib/services/user.service';
import { permissionsForRole } from '@/lib/auth/permissions';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
import { canRunHotelImport } from '@/lib/import/auth';
import { fetchControlPlaneOrganizationName } from '@era/satellite-kit';

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

    const profile = await prisma.hotelProfile.findFirst({
      select: { name: true, organizationId: true },
    });

    // Company name is owned by the orchestrator (control plane). Prefer it and
    // fall back to the local hotel profile name if the control plane is unreachable.
    const controlPlaneName = profile?.organizationId
      ? await fetchControlPlaneOrganizationName(profile.organizationId)
      : null;

    const canRunElektrawebImport = await canRunHotelImport({
      email: user.email,
      login: user.login,
      status: user.status,
      roleCode: user.role.code,
    });

    return jsonOk({
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role.code,
      department: user.department,
      permissions: userPermissions(user),
      rolePermissions: permissionsForRole(user.role.code),
      organizationName: controlPlaneName ?? profile?.name ?? null,
      organizationId: profile?.organizationId ?? null,
      isPlatformSuperAdmin: isPlatformSuperAdminUser(user),
      canRunElektrawebImport,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
