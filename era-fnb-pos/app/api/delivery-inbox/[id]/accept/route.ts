import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = await prisma.deliveryInboxOrder.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const updated = await prisma.deliveryInboxOrder.update({
    where: { id },
    data: { status: "ACCEPTED" },
  });
  return NextResponse.json(updated);
}
