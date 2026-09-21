import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSessionFromRequest } from "@/lib/session";
import {
  ensureSystemFnbRoles,
  resolveFnbEdition,
} from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import {
  ALL_PERMISSIONS,
  effectiveRolePermissions,
  isSystemFnbRoleCode,
} from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { prisma } from "@/lib/prisma";
import { permissionsForRoleCode } from "@/lib/auth/fnb-permission.service";

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.organizationId) return jsonError("Unauthorized", 401);

    const organizationId = session.organizationId;
    const profile = await getFnbOrgProfile(organizationId);
    const edition = resolveFnbEdition(profile.edition, profile.hotelMode);
    await ensureSystemFnbRoles(prisma, organizationId, edition);

    let permissions = session.permissions ?? [];
    let fullName = session.fullName;
    let login = session.login;
    let email = session.email ?? null;
    let role = session.role;

    if (session.pin === true) {
      if (isSystemFnbRoleCode(session.role)) {
        permissions = await permissionsForRoleCode(organizationId, session.role);
      }
    } else {
      const user = await prisma.user.findUnique({
        where: { id: session.sub },
        include: { role: true },
      });
      if (user) {
        fullName = user.fullName;
        login = user.login;
        email = user.email;
        role = user.role.code;
        const bypass = hasFnbPermissionBypass({
          login: user.login,
          email: user.email ?? undefined,
          role: user.role.code,
          isOwner: session.isOwner,
        });
        permissions = bypass
          ? [...ALL_PERMISSIONS]
          : effectiveRolePermissions(
              user.role.code,
              user.role.permissionsJson,
              edition,
            );
      }
    }

    return jsonOk({
      id: session.sub,
      login,
      fullName,
      email,
      role,
      organizationId,
      organizationName: null,
      permissions,
      pin: session.pin === true,
      outletId: session.outletId ?? null,
      isOwner: session.isOwner === true,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
