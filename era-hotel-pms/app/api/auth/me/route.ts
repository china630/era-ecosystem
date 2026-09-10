import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { userPermissions } from '@/lib/services/user.service';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
import { canRunHotelImport } from '@/lib/import/auth';
import { fetchControlPlaneOrganizationName } from '@era/satellite-kit';
import { ALL_PERMISSIONS } from '@/lib/auth/permissions';
import { hasHotelPermissionBypass } from '@/lib/auth/permission-check';

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

    const bypass = hasHotelPermissionBypass({
      login: user.login,
      email: user.email ?? undefined,
      role: user.role.code,
      isOwner: session.isOwner,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : userPermissions(user);

    return jsonOk({
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role.code,
      department: user.department,
      permissions,
      organizationName: controlPlaneName ?? profile?.name ?? null,
      organizationId: profile?.organizationId ?? null,
      isPlatformSuperAdmin: isPlatformSuperAdminUser(user),
      isOwner: session.isOwner === true || user.role.code === 'BUSINESS_OWNER',
      canRunElektrawebImport,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
