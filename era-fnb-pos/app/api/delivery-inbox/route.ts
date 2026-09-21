import { assertFnbEntitled, handleRouteError } from "@/lib/api-utils";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { DELIVERY_ACCEPT } from "@/lib/auth/read-permission-sets";

const createSchema = z.object({
  externalRef: z.string().min(1),
  channel: z.string().default("aggregator"),
  payload: z.record(z.unknown()).optional(),
});

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, DELIVERY_ACCEPT);
    if (denied) return denied;
    const orders = await prisma.deliveryInboxOrder.findMany({
      where: { status: { in: ["NEW", "ACCEPTED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(orders);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, DELIVERY_ACCEPT);
    if (denied) return denied;
    const body = createSchema.parse(await request.json());
    const order = await prisma.deliveryInboxOrder.create({
      data: {
        externalRef: body.externalRef,
        channel: body.channel,
        payloadJson: body.payload ? JSON.stringify(body.payload) : null,
      },
    });
    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
