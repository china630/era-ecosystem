import { jsonError, handleRouteError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dispatchFbShiftClosed } from "@/lib/fb-finance-events";
import { prisma } from "@/lib/prisma";
import { reportPosShiftStatus } from "@/lib/pms-bridge-client";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { saleReportForShift } from "@/lib/sales-report";
import { cashDrawerForShift } from "@/lib/cash-drawer";

const closeSchema = z.object({
  shiftId: z.string().optional(),
  countedCash: z.number().nonnegative(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SHIFTS_CLOSE);
    if (denied) return denied;

    const parsed = closeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError("Counted cash is required", 400);
    const body = parsed.data;

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

    const report = await saleReportForShift(shift.id);
    const closedAt = new Date();
    const drawer = await cashDrawerForShift({
      ...shift,
      closedAt,
      countedCash: body.countedCash,
    });

    const closed = await prisma.posShift.update({
      where: { id: shift.id },
      data: {
        status: "CLOSED",
        closedAt,
        countedCash: body.countedCash,
        expectedCash: drawer.expected,
        cashVariance: drawer.variance,
      },
      include: { outlet: true },
    });

    await reportPosShiftStatus({
      outletCode: shift.outlet.code,
      status: "CLOSED",
      shiftId: shift.id,
      closedAt: closed.closedAt?.toISOString(),
    });

    if (closed.closedAt) {
      await prisma.outlet.update({
        where: { id: closed.outletId },
        data: { terminalRevokedAt: closed.closedAt },
      });
      void dispatchFbShiftClosed({
        shiftId: closed.id,
        outletId: closed.outletId,
        outletCode: closed.outlet.code,
        openedAt: closed.openedAt,
        closedAt: closed.closedAt,
      }).catch(() => {
        // Shift already closed; Finance recon is best-effort
      });
    }

    return NextResponse.json({ ...closed, report, drawer });
  } catch (err) {
    return handleRouteError(err);
  }
}
