import { prisma } from "@/lib/prisma";
import { getSatelliteSession, jsonError, handleRouteError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { denyUnlessPermission } from "@/lib/auth/require";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);

    const denied = denyUnlessPermission(
      session,
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
  } catch (err) {
    return handleRouteError(err);
  }
}
