import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tickets = await prisma.ticket.findMany({
    where: { status: { in: ["OPEN", "HELD"] } },
    include: { table: true, lines: true },
    orderBy: { openedAt: "desc" },
    take: 100,
  });
  return NextResponse.json(tickets);
}

const createSchema = z.object({
  outletCode: z.string().default("RESTAURANT"),
  tableId: z.string().optional(),
  covers: z.number().int().positive().optional(),
  guestName: z.string().optional(),
  lines: z
    .array(
      z.object({
        description: z.string(),
        qty: z.number().int().positive().default(1),
        unitPriceAzn: z.number().nonnegative(),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
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

  const ticket = await prisma.ticket.create({
    data: {
      outletId: outlet.id,
      tableId: body.tableId,
      covers: body.covers ?? 1,
      guestName: body.guestName,
      subtotalAzn: subtotal,
      totalAzn: subtotal,
      lines: {
        create: lines.map((l) => ({
          description: l.description,
          qty: l.qty,
          unitPriceAzn: l.unitPriceAzn,
        })),
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
