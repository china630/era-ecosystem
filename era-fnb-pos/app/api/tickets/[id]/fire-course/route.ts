import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

const bodySchema = z.object({
  courseNumber: z.number().int().positive(),
  delayMinutes: z.number().int().nonnegative().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.WAITER, FB_ROLES.MANAGER]);
  if (denied) return denied;

  const { id } = await params;
  const body = bodySchema.parse(await request.json());
  const fireAt = body.delayMinutes
    ? new Date(Date.now() + body.delayMinutes * 60_000)
    : new Date();

  const result = await prisma.ticketLine.updateMany({
    where: {
      ticketId: id,
      courseNumber: body.courseNumber,
      kitchenStatus: "NEW",
    },
    data: {
      kitchenStatus: "FIRED",
      scheduledFireAt: fireAt,
    },
  });

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { lines: true },
  });
  return NextResponse.json({ ticket, firedCount: result.count, fireAt });
}
