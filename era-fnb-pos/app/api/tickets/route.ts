import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const beoId = url.searchParams.get("beoId");
  const serviceChannel = url.searchParams.get("serviceChannel");
  const outletIdParam = url.searchParams.get("outletId");
  const selectedOutlet = outletIdParam ?? (await getSelectedOutletId());

  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: ["OPEN", "HELD"] },
      ...(beoId ? { beoId } : {}),
      ...(serviceChannel ? { serviceChannel } : {}),
      ...(selectedOutlet ? { outletId: selectedOutlet } : {}),
    },
    include: { table: true, lines: true },
    orderBy: { openedAt: "desc" },
    take: 100,
  });
  return NextResponse.json(tickets);
}

const createSchema = z.object({
  outletCode: z.string().default("RESTAURANT"),
  tableId: z.string().optional(),
  beoId: z.string().optional(),
  serviceChannel: z.enum(["DINE_IN", "ROOM_SERVICE", "WALK_IN", "TAKEAWAY"]).optional(),
  walkInLabel: z.string().max(120).optional(),
  covers: z.number().int().positive().optional(),
  guestName: z.string().optional(),
  lines: z
    .array(
      z.object({
        description: z.string(),
        qty: z.number().int().positive().default(1),
        unitPriceAzn: z.number().nonnegative(),
        menuItemPlu: z.string().optional(),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.WAITER, FB_ROLES.MANAGER]);
  if (denied) return denied;

  const body = createSchema.parse(await request.json());
  let outlet = await prisma.outlet.findUnique({
    where: { code: body.outletCode },
  });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: { code: body.outletCode, name: body.outletCode },
    });
  }

  const lines = body.lines ?? [];
  const subtotal = lines.reduce(
    (s, l) => s + l.qty * l.unitPriceAzn,
    0,
  );

  const channel =
    body.serviceChannel ??
    (body.walkInLabel ? "WALK_IN" : body.tableId ? "DINE_IN" : undefined);

  const ticket = await prisma.ticket.create({
    data: {
      outletId: outlet.id,
      tableId: body.tableId,
      covers: body.covers ?? 1,
      guestName: body.guestName,
      serviceChannel: channel,
      walkInLabel: body.walkInLabel,
      beoId: body.beoId,
      subtotalAzn: subtotal,
      totalAzn: subtotal,
      lines: {
        create: await Promise.all(
          lines.map(async (l) => {
            let menuItemId: string | undefined;
            if (l.menuItemPlu) {
              const menuItem = await prisma.menuItem.findFirst({
                where: { plu: l.menuItemPlu },
              });
              menuItemId = menuItem?.id;
            }
            return {
              description: l.description,
              qty: l.qty,
              unitPriceAzn: l.unitPriceAzn,
              menuItemId,
            };
          }),
        ),
      },
    },
    include: { lines: true, table: true },
  });

  if (body.tableId) {
    await prisma.posTable.update({
      where: { id: body.tableId },
      data: { status: "OCCUPIED", currentTicketId: ticket.id },
    });
  }

  return NextResponse.json(ticket, { status: 201 });
}
