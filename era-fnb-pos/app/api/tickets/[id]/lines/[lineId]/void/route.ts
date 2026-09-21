import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordFbAudit } from "@/lib/satellite-audit";

const voidSchema = z.object({
  reason: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_VOID);
  if (denied) return denied;

  const { id, lineId } = await params;
  const body = voidSchema.parse(await request.json());

  const line = await prisma.ticketLine.findFirst({
    where: { id: lineId, ticketId: id },
  });
  if (!line) {
    return NextResponse.json({ error: "Line not found" }, { status: 404 });
  }
  if (line.kitchenStatus === "VOID") {
    return NextResponse.json({ error: "Line already void" }, { status: 400 });
  }

  await prisma.ticketLine.update({
    where: { id: lineId },
    data: {
      kitchenStatus: "VOID",
      notes: body.reason,
    },
  });

  await recordFbAudit(
    { userId: session?.sub, request },
    "TicketLine",
    lineId,
    "VOID",
    { ticketId: id, reason: body.reason, lineName: line.description },
  );

  const updated = await recalculateTicketTotals(id);
  const lines = await prisma.ticketLine.findMany({ where: { ticketId: id } });

  return NextResponse.json({ ticket: { ...updated, lines }, reason: body.reason });
}
