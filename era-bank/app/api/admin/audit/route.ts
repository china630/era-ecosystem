import { prisma } from "@/lib/prisma";
import { getRouteSession, jsonError } from "@/lib/api-utils";

export async function GET() {
  const session = await getRouteSession();
  if (!session) return jsonError("Unauthorized", 401);

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
