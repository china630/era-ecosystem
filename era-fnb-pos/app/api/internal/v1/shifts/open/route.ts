import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Hotel night audit asks which outlets still have a live open shift. */
export async function GET(request: Request) {
  const secret = process.env.POS_BRIDGE_SECRET?.trim();
  const header = request.headers.get("x-pos-bridge-secret");
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shifts = await prisma.posShift.findMany({
    where: { status: "OPEN" },
    include: { outlet: true },
    orderBy: { openedAt: "asc" },
  });

  return NextResponse.json({
    open: shifts.map((shift) => ({
      outletCode: shift.outlet.code,
      shiftId: shift.id,
      openedAt: shift.openedAt.toISOString(),
    })),
  });
}
