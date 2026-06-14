import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        patientRef: true,
        practitioner: true,
        serviceLines: true,
      },
    });
    if (!visit) return jsonError("Visit not found", 404);
    return jsonOk(visit);
  } catch (err) {
    return handleRouteError(err);
  }
}
