import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const orders = await prisma.maintenanceWorkOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const body = await request.json();
  const wo = await prisma.maintenanceWorkOrder.create({
    data: {
      roomId: body.roomId ?? null,
      title: String(body.title ?? "Maintenance"),
      reportedBy: body.reportedBy ?? null,
      status: "OPEN",
    },
  });
  return NextResponse.json(wo, { status: 201 });
}
