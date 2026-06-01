import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  externalRef: z.string().min(1),
  channel: z.string().default("aggregator"),
  payload: z.record(z.unknown()).optional(),
});

export async function GET() {
  const orders = await prisma.deliveryInboxOrder.findMany({
    where: { status: { in: ["NEW", "ACCEPTED"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const body = createSchema.parse(await request.json());
  const order = await prisma.deliveryInboxOrder.create({
    data: {
      externalRef: body.externalRef,
      channel: body.channel,
      payloadJson: body.payload ? JSON.stringify(body.payload) : null,
    },
  });
  return NextResponse.json(order, { status: 201 });
}
