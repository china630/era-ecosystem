import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tickets = await prisma.queueTicket.findMany({
      where: { status: { in: ["WAITING", "CALLED"] } },
      include: {
        visit: { include: { patientRef: true, practitioner: true } },
      },
      orderBy: [{ status: "asc" }, { queueNumber: "asc" }],
      take: 50,
    });
    return jsonOk({ tickets });
  } catch (err) {
    return handleRouteError(err);
  }
}
