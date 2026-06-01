import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const AGENT_ROLES = ["SALES_AGENT", "SALES_LEAD", "BUSINESS_OWNER"];

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { code: { in: AGENT_ROLES } },
      },
      select: {
        id: true,
        login: true,
        fullName: true,
        role: { select: { code: true } },
      },
      orderBy: { fullName: "asc" },
    });
    return jsonOk(users);
  } catch (err) {
    return handleRouteError(err);
  }
}
