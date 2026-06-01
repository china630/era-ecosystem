import { NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z.object({
  event: z.enum(["checked_out", "cancelled"]),
  reservationId: z.string(),
  roomNumber: z.string().optional(),
});

/** PMS → fb-pos: close open tickets linked to departed guest (doc/openapi). */
export async function POST(request: Request) {
  const secret = request.headers.get("x-fb-pos-webhook-secret");
  if (
    process.env.FB_POS_WEBHOOK_SECRET &&
    secret !== process.env.FB_POS_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = payloadSchema.parse(await request.json());
  return NextResponse.json({ received: true, ...body });
}
