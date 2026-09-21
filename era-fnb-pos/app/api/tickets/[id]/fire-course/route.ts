import { assertFnbEntitled } from "@/lib/api-utils";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

const bodySchema = z.object({
  courseNumber: z.number().int().positive(),
  delayMinutes: z.number().int().nonnegative().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_FIRE);
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
