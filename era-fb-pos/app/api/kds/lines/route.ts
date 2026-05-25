import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const lines = await prisma.ticketLine.findMany({
    where: { kitchenStatus: { in: ["NEW", "FIRED", "IN_PREP"] } },
    include: { ticket: { include: { table: true, outlet: true } } },
    orderBy: { ticket: { openedAt: "asc" } },
    take: 100,
  });
  return NextResponse.json(lines);
}
