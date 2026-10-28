import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const outlets = await prisma.outlet.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        revenueCode: true,
        phone: true,
        email: true,
        address: true,
        website: true,
      },
    });
    return jsonOk({ outlets });
  } catch (err) {
    return handleRouteError(err);
  }
}
