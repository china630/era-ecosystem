import { NextResponse } from "next/server";
import { lookupLegalEntityByVoen } from "@era/satellite-kit";
import { handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const body = (await request.json()) as { taxId?: string };
    const taxId = body.taxId?.trim();
    if (!taxId) {
      return NextResponse.json({ error: "taxId required" }, { status: 400 });
    }
    const result = await lookupLegalEntityByVoen(taxId);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
