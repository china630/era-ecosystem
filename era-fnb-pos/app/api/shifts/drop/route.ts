import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { cashDrawerForShift } from "@/lib/cash-drawer";

const dropSchema = z.object({
  shiftId: z.string().optional(),
  amountAzn: z.number().positive(),
  note: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SHIFTS_CLOSE);
    if (denied) return denied;
    const body = dropSchema.parse(await request.json());
    const shift = body.shiftId
      ? await prisma.posShift.findUnique({
          where: { id: body.shiftId },
          include: { outlet: true },
        })
      : await prisma.posShift.findFirst({
          where: { status: "OPEN" },
          include: { outlet: true },
          orderBy: { openedAt: "desc" },
        });
    if (!shift || shift.status !== "OPEN") return jsonError("Open shift not found", 404);
    await prisma.posCashDrop.create({
      data: {
        organizationId: requestOrganizationId(),
        shiftId: shift.id,
        amountAzn: body.amountAzn,
        note: body.note?.trim() || null,
      },
    });
    return jsonOk(await cashDrawerForShift(shift));
  } catch (err) {
    return handleRouteError(err);
  }
}
