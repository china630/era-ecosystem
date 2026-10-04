import { jsonOk, jsonError, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import { isPlatformSuperAdminEdge } from "@/lib/auth/platform-super-admin-edge";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { prisma } from "@/lib/prisma";

/** Signed-in person and current DB grants for the ops shell and client doors. */
export async function GET() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, login: true, email: true, fullName: true },
    });
    if (!user) return jsonError("User not found", 404);

    return jsonOk({
      id: user.id,
      login: user.login,
      email: user.email,
      fullName: user.fullName,
      role: session.role,
      organizationId: session.organizationId,
      organizationName: null,
      permissions: session.permissions,
      isOwner: session.isOwner === true || session.role === OWNER_ROLE_CODE,
      isPlatformSuperAdmin: isPlatformSuperAdminEdge(user),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
