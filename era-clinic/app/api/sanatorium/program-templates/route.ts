import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const rows = await prisma.programTemplate.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, durationDays: true },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
