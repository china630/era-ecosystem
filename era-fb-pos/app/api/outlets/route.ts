import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSelectedOutletId } from "@/lib/outlet-session";

export async function GET() {
  const outlets = await prisma.outlet.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
  });
  const selectedOutletId = await getSelectedOutletId();
  return NextResponse.json({ outlets, selectedOutletId });
}
