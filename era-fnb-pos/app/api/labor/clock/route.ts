import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, assertFnbEntitled } from "@/lib/api-utils";
import { pinMatches } from "@/lib/labor-pin";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  staffCode: z.string().min(1),
  pin: z.string().min(4).max(8),
  eventType: z.enum(["CLOCK_IN", "CLOCK_OUT"]).default("CLOCK_IN"),
});

export async function POST(req: Request) {
  await assertFnbEntitled();
  try {
    const body = bodySchema.parse(await req.json());
    const staff = await prisma.staffRoster.findFirst({
      where: { staffCode: body.staffCode },
    });
    if (!staff || !staff.active) return jsonError("Staff not found", 404);
    if (!pinMatches(staff.pinHash, body.pin)) return jsonError("Invalid PIN", 401);
    const event = await prisma.pinClockEvent.create({
      data: {
        staffCode: body.staffCode,
        eventType: body.eventType,
      },
    });
    return jsonOk(event, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
