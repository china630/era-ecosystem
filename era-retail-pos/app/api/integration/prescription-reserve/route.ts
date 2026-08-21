import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    patientRef?: string;
    visitId?: string;
    lines?: Array<{ sku: string; qty: number; rxRequired?: boolean; description?: string }>;
  };
  const lines = body.lines ?? [];
  if (lines.length === 0) {
    return NextResponse.json({ error: "lines required" }, { status: 400 });
  }

  let shift = await prisma.shift.findFirst({
    where: { status: "OPEN" },
    include: { register: { include: { outlet: true } } },
    orderBy: { openedAt: "desc" },
  });
  if (!shift) {
    const register = await prisma.register.findFirst({ include: { outlet: true } });
    if (!register) {
      return NextResponse.json({ error: "no register" }, { status: 503 });
    }
    shift = await prisma.shift.create({
      data: { registerId: register.id, status: "OPEN" },
      include: { register: { include: { outlet: true } } },
    });
  }
  if (!shift) throw new Error("shift unavailable");

  const receipt = await prisma.receipt.create({
    data: {
      outletId: shift.register.outletId,
      shiftId: shift.id,
      registerId: shift.registerId,
      status: "OPEN",
      amountNet: 0,
      subtotalAmount: 0,
      lines: {
        create: lines.map((l) => ({
          plu: l.sku,
          description: l.description ?? l.sku,
          qty: l.qty,
          unitPrice: 0,
          lineTotal: 0,
          rxRequired: l.rxRequired ?? false,
        })),
      },
    },
    include: { lines: true },
  });

  return NextResponse.json({
    reserved: true,
    receiptId: receipt.id,
    patientRef: body.patientRef,
    visitId: body.visitId,
  });
}
