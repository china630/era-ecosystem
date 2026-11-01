import { NextRequest } from "next/server";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { enterRequestTenant } from "@/lib/request-organization";
import {
  clearStayProceduresAtCheckout,
  listStayProceduresForCheckout,
} from "@/domain/sanatorium/stay-checkout-snapshot.service";
import { z } from "zod";

function assertServiceToken(req: NextRequest): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

/** Hotel checkout reads paid procedures and package attendance for one reservation. */
export async function GET(req: NextRequest) {
  try {
    if (!assertServiceToken(req)) return jsonError("Unauthorized", 401);
    const url = new URL(req.url);
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? "";
    const reservationId = url.searchParams.get("reservationId")?.trim() ?? "";
    if (!organizationId || !reservationId) {
      return jsonError("organizationId and reservationId required", 400);
    }
    enterRequestTenant(organizationId);
    return jsonOk(await listStayProceduresForCheckout(reservationId));
  } catch (err) {
    return handleRouteError(err);
  }
}

const clearSchema = z.object({
  organizationId: z.string().min(1),
  reservationId: z.string().min(1),
});

/** Hotel check-out: cancel future extras / package seats; apply no-show policy. */
export async function POST(req: NextRequest) {
  try {
    if (!assertServiceToken(req)) return jsonError("Unauthorized", 401);
    const body = clearSchema.parse(await req.json());
    enterRequestTenant(body.organizationId);
    return jsonOk(await clearStayProceduresAtCheckout(body.reservationId));
  } catch (err) {
    return handleRouteError(err);
  }
}
