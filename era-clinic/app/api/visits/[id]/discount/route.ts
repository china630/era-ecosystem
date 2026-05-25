import { z } from "zod";
import {
  getRouteSession,
  hasClinicAdminRole,
  jsonOk,
  jsonError,
  handleRouteError,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  percent: z.number().min(0).max(100),
  reason: z.string().min(3),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    if (!hasClinicAdminRole(session)) {
      return jsonError("CLINIC_ADMIN or BUSINESS_OWNER required", 403);
    }

    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) return jsonError("Visit not found", 404);
    if (visit.status === "COMPLETED") {
      return jsonError("Cannot discount a completed visit", 400);
    }

    const currentAmount = Number(visit.amountNet);
    const discountedAmount =
      Math.round(currentAmount * (1 - body.percent / 100) * 100) / 100;

    const [updatedVisit, audit] = await prisma.$transaction([
      prisma.visit.update({
        where: { id },
        data: { amountNet: discountedAmount },
      }),
      prisma.visitDiscountAudit.create({
        data: {
          visitId: id,
          percent: body.percent,
          approvedBy: session.sub,
          reason: body.reason,
        },
      }),
    ]);

    return jsonOk({ visit: updatedVisit, audit });
  } catch (err) {
    return handleRouteError(err);
  }
}
