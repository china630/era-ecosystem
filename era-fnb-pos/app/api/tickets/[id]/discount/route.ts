import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

const discountSchema = z.object({
  discountPercent: z.number().min(0).max(100),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.MANAGER]);
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

  await prisma.ticket.update({
    where: { id },
    data: { discountPercent: body.discountPercent },
  });
  const updated = await recalculateTicketTotals(id);
  return NextResponse.json(updated);
}
