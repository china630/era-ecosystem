import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { releaseTableForTicket } from "@/lib/ticket-helpers";

const paySchema = z.object({
  method: z.enum(["CASH", "CARD"]),
  amount: z.number().positive().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = paySchema.parse(await request.json());

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { table: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!["OPEN", "HELD"].includes(ticket.status)) {
    return NextResponse.json(
      { error: "Ticket is not open for payment" },
      { status: 400 },
    );
  }

  const amount = body.amount ?? Number(ticket.totalAzn);

  await prisma.ticket.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  await releaseTableForTicket(id, ticket.tableId);

  return NextResponse.json(
    {
      ticketId: id,
      method: body.method,
      amount,
      status: "PAID",
      fiscal: {
        stub: true,
        receiptId: `kkm-stub-${id.slice(0, 8)}`,
        qrPayload: "MOCK-QR-PAYLOAD",
      },
    },
    { status: 201 },
  );
}
