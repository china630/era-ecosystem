import { jsonOk, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";
    const rows = await prisma.userLogin.findMany({
      where: {
        organizationId: session.organizationId,
        ...(q
          ? {
              OR: [
                { login: { contains: q, mode: "insensitive" } },
                { user: { fullName: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
                ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { fullName: true, login: true } } },
    });
    return jsonOk(
      rows.map((row) => ({
        id: row.id,
        login: row.login || row.user.login,
        fullName: row.user.fullName,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
