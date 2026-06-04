import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.procedureType.findMany({
      orderBy: { code: "asc" },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
