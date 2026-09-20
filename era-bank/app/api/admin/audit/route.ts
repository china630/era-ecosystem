import { prisma } from "@/lib/prisma";
import { getRouteSession, jsonError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { denyUnlessPermission } from "@/lib/auth/require";
import { permissionsForUserId } from "@/lib/auth/bank-permission.service";

export async function GET() {
  const session = await getRouteSession();
  if (!session) return jsonError("Unauthorized", 401);

  const permissions = await permissionsForUserId(session.sub);
  const denied = denyUnlessPermission(
    { ...session, permissions },
    PERMISSIONS.AUDIT_READ,
  );
  if (denied) return denied;

  const rows = await prisma.opsActionLog.findMany({
    orderBy: { at: "desc" },
    take: 100,
    include: {
      opsUser: { select: { username: true, fullName: true } },
    },
  });

  return Response.json(
    rows.map((r) => ({
      id: r.id,
      action: r.action,
      refType: r.refType,
      refId: r.refId,
      metadataJson: r.metadataJson,
      at: r.at.toISOString(),
      opsUser: r.opsUser.username,
      fullName: r.opsUser.fullName,
    })),
  );
}
