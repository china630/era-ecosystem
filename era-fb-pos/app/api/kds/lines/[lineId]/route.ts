import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  kitchenStatus: z.enum(["IN_PREP", "DONE"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lineId: string }> },
) {
  const { lineId } = await params;
  const body = patchSchema.parse(await request.json());

  const line = await prisma.ticketLine.findUnique({ where: { id: lineId } });
  if (!line) {
    return NextResponse.json({ error: "Line not found" }, { status: 404 });
  }
  if (!["FIRED", "IN_PREP"].includes(line.kitchenStatus)) {
    return NextResponse.json(
      { error: "Line must be FIRED or IN_PREP to bump" },
      { status: 400 },
    );
  }

  const updated = await prisma.ticketLine.update({
    where: { id: lineId },
    data: { kitchenStatus: body.kitchenStatus },
    include: { ticket: { include: { table: true, outlet: true } } },
  });

  return NextResponse.json(updated);
}
