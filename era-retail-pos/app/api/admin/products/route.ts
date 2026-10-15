import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const products = await prisma.productCache.findMany({
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        description: true,
        revenueCode: true,
        categoryId: true,
      },
    });
    return jsonOk({ products });
  } catch (err) {
    return handleRouteError(err);
  }
}
