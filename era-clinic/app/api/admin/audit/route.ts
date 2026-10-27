import { bakuDayBounds } from "@era/satellite-kit/time";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType") ?? "HTTP_MUTATION";
    const entityId = url.searchParams.get("entityId") ?? undefined;
    const action = url.searchParams.get("action") ?? undefined;
    const userId = url.searchParams.get("userId") ?? undefined;
    const dateFromParam = url.searchParams.get("dateFrom");
    const dateToParam = url.searchParams.get("dateTo");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (dateFromParam && /^\d{4}-\d{2}-\d{2}$/.test(dateFromParam)) {
      createdAt.gte = bakuDayBounds(dateFromParam).start;
    }
    if (dateToParam && /^\d{4}-\d{2}-\d{2}$/.test(dateToParam)) {
      createdAt.lte = bakuDayBounds(dateToParam).end;
    }
    const rows = await prisma.satelliteAuditLog.findMany({
      where: {
        entityType,
        ...(entityId ? { entityId } : {}),
        ...(action ? { action } : {}),
        ...(userId ? { userId } : {}),
        ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return jsonOk(
      rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        changes: JSON.parse(r.changesJson || "{}"),
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
