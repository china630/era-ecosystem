import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reportPosShiftStatus } from "@/lib/pms-bridge-client";

const openSchema = z.object({
  outletCode: z.string().default("RESTAURANT"),
  openingCash: z.number().nonnegative().default(0),
});

export async function GET() {
  const shift = await prisma.posShift.findFirst({
    where: { status: "OPEN" },
    include: { outlet: true },
    orderBy: { openedAt: "desc" },
  });
  return NextResponse.json(shift ?? { status: "NONE" });
}

export async function POST(request: Request) {
  const body = openSchema.parse(await request.json());

  let outlet = await prisma.outlet.findUnique({
    where: { code: body.outletCode },
  });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: { code: body.outletCode, name: body.outletCode },
    });
  }

  const existing = await prisma.posShift.findFirst({
    where: { outletId: outlet.id, status: "OPEN" },
    include: { outlet: true },
  });
  if (existing) {
    return NextResponse.json(existing);
  }

  const shift = await prisma.posShift.create({
    data: {
      outletId: outlet.id,
      openingCash: body.openingCash,
    },
    include: { outlet: true },
  });

  await reportPosShiftStatus({
    outletCode: outlet.code,
    status: "OPEN",
    shiftId: shift.id,
  });

  return NextResponse.json(shift, { status: 201 });
}
