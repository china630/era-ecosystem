import { z } from "zod";
import { createHash } from "crypto";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  staffCode: z.string().min(1),
  pin: z.string().min(4).max(8),
  eventType: z.enum(["CLOCK_IN", "CLOCK_OUT"]).default("CLOCK_IN"),
});

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const staff = await prisma.staffRoster.findUnique({
      where: { staffCode: body.staffCode },
    });
    if (!staff || !staff.active) return jsonError("Staff not found", 404);
    if (staff.pinHash !== hashPin(body.pin)) return jsonError("Invalid PIN", 401);
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
