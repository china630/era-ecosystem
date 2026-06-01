import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return jsonError("token required", 400);

    const visits = await prisma.visit.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        patientRef: { select: { refCode: true, fullName: true } },
        labOrders: { take: 5 },
      },
    });

    return jsonOk({
      mode: "portal_live",
      token,
      visits: visits.map((v) => ({
        id: v.id,
        status: v.status,
        patient: v.patientRef,
        labOrders: v.labOrders.length,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
