import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { DELIVERY_ACCEPT } from "@/lib/auth/read-permission-sets";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = denyUnlessAnyPermission(session, DELIVERY_ACCEPT);
  if (denied) return denied;
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
