import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reportPosShiftStatus } from "@/lib/pms-bridge-client";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

const closeSchema = z.object({
  shiftId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
  if (denied) return denied;

  const body = closeSchema.parse(await request.json().catch(() => ({})));

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

  if (!shift) {
    return NextResponse.json({ error: "Open shift not found" }, { status: 404 });
  }
  if (shift.status === "CLOSED") {
    return NextResponse.json(shift);
  }

  const openTickets = await prisma.ticket.count({
    where: {
      outletId: shift.outletId,
      status: { in: ["OPEN", "HELD"] },
    },
  });
  if (openTickets > 0) {
    return NextResponse.json(
      { error: "Cannot Z-close with open tickets", openTickets },
      { status: 409 },
    );
  }

  const closed = await prisma.posShift.update({
    where: { id: shift.id },
    data: { status: "CLOSED", closedAt: new Date() },
    include: { outlet: true },
  });

  await reportPosShiftStatus({
    outletCode: shift.outlet.code,
    status: "CLOSED",
    shiftId: shift.id,
    closedAt: closed.closedAt?.toISOString(),
  });

  return NextResponse.json(closed);
}
