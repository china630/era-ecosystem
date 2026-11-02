import { jsonOk } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { enterRequestTenant } from "@/lib/request-organization";
import { listClinicSyncSnapshot } from "@/lib/services/clinic-sync-snapshot.service";

const bodySchema = z.object({
  organizationId: z.string().min(1),
  openReservationIds: z.array(z.string().min(1)).max(200).default([]),
});

function assertServiceToken(request: Request): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === expected;
}

/** In-house medical guests plus which of the clinic's open stays are already checked out. */
export async function POST(request: Request) {
  if (!assertServiceToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = bodySchema.parse(await request.json());
  enterRequestTenant(body.organizationId);
  const snapshot = await listClinicSyncSnapshot(body);
  return jsonOk(snapshot);
}
