import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [bays, appointments] = await Promise.all([
      prisma.bay.findMany({ include: { lifts: true }, orderBy: { code: "asc" } }),
      prisma.appointment.findMany({
        where: { scheduledAt: { gte: new Date(Date.now() - 86400000) } },
        orderBy: { scheduledAt: "asc" },
        take: 100,
      }),
    ]);
    return jsonOk({ bays, appointments });
  } catch (err) {
    return handleRouteError(err);
  }
}
