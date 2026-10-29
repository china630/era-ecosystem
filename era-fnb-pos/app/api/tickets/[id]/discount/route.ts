import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { recordFbAudit } from "@/lib/satellite-audit";

const discountSchema = z.object({
  discountPercent: z.number().min(0).max(100),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_DISCOUNT);
    if (denied) return denied;

    const { id } = await params;
    const body = discountSchema.parse(await request.json());

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (!["OPEN", "HELD"].includes(ticket.status)) {
      return NextResponse.json({ error: "Ticket is closed" }, { status: 400 });
    }

    const before = Number(ticket.discountPercent ?? 0);
    await prisma.ticket.update({
      where: { id },
      data: { discountPercent: body.discountPercent },
    });
    const updated = await recalculateTicketTotals(id);
    await recordFbAudit(
      { userId: session?.sub, request },
      "Ticket",
      id,
      "DISCOUNT",
      {
        discountPercent: { from: before, to: body.discountPercent },
        totalAzn: updated ? Number(updated.totalAzn) : undefined,
      },
    );
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
