import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rules = await prisma.yieldRule.findMany({
    where: { active: true },
    orderBy: { minOccupancyPct: "asc" },
  });
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const body = await request.json();
  const rule = await prisma.yieldRule.create({
    data: {
      propertyCode: String(body.propertyCode ?? "DEFAULT"),
      minOccupancyPct: Number(body.minOccupancyPct ?? 70),
      rateAdjustment: Number(body.rateAdjustment ?? 5),
      active: true,
    },
  });
  return NextResponse.json(rule, { status: 201 });
}
