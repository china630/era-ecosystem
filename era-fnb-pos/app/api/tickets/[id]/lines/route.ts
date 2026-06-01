import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

const lineSchema = z.object({
  description: z.string().min(1),
  qty: z.number().int().positive().default(1),
  unitPriceAzn: z.number().nonnegative(),
  menuItemPlu: z.string().optional(),
  notes: z.string().optional(),
});

const createSchema = z.union([lineSchema, z.array(lineSchema)]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.WAITER, FB_ROLES.MANAGER]);
  if (denied) return denied;

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!["OPEN", "HELD"].includes(ticket.status)) {
    return NextResponse.json(
      { error: "Ticket is not open for new lines" },
      { status: 400 },
    );
  }

  const parsed = createSchema.parse(await request.json());
  const items = Array.isArray(parsed) ? parsed : [parsed];

  for (const item of items) {
    let menuItemId: string | undefined;
    if (item.menuItemPlu) {
      const menuItem = await prisma.menuItem.findFirst({
        where: { plu: item.menuItemPlu },
      });
      menuItemId = menuItem?.id;
    }

    await prisma.ticketLine.create({
      data: {
        ticketId: id,
        menuItemId,
        description: item.description,
        qty: item.qty,
        unitPriceAzn: item.unitPriceAzn,
        notes: item.notes,
      },
    });
  }

  const updated = await recalculateTicketTotals(id);
  const lines = await prisma.ticketLine.findMany({ where: { ticketId: id } });

  return NextResponse.json({ ...updated, lines }, { status: 201 });
}
