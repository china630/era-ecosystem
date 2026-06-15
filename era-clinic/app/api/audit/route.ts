import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? "100");
    const rows = await prisma.satelliteAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 500),
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
