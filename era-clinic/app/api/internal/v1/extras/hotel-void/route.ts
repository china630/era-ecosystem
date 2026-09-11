import { z } from "zod";
import { NextRequest } from "next/server";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { enterRequestTenant } from "@/lib/request-organization";
import { applyHotelVoidToExtra } from "@/domain/sanatorium/extras-assign.service";

/**
 * CLI-57 W4 — hotel folio void inbound → cancel clinic extra + invalidate ticket.
 * Auth: Bearer SATELLITE_EVENT_SERVICE_TOKEN (same class as lifecycle).
 */
const schema = z.object({
  organizationId: z.string().min(1),
  externalTicketId: z.string().optional(),
  orderId: z.string().optional(),
});

function assertServiceToken(req: NextRequest): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN;
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

export async function POST(req: NextRequest) {
  try {
    if (!assertServiceToken(req)) return jsonError("Unauthorized", 401);
    const body = schema.parse(await req.json());
    if (!body.externalTicketId && !body.orderId) {
      return jsonError("externalTicketId or orderId required", 400);
    }
    enterRequestTenant(body.organizationId);
    const result = await applyHotelVoidToExtra({
      externalTicketId: body.externalTicketId,
      orderId: body.orderId,
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
