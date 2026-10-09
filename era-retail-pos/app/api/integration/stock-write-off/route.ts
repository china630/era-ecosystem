import { NextResponse } from "next/server";
import { stockWriteOffDenied } from "@/lib/stock-gates";
import { getSatelliteSession, handleRouteError, jsonError } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
  } catch (err) {
    return handleRouteError(err);
  }
  const body = (await request.json()) as {
    source?: string;
    procedureOrderId?: string;
    lines?: Array<{ sku: string; qty: number; description?: string }>;
    correlationId?: string;
  };
  const lines = body.lines ?? [];
  const denied = stockWriteOffDenied(lines);
  if (denied) {
    return NextResponse.json({ error: denied }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "day document",
    lineCount: lines.length,
  });
}
