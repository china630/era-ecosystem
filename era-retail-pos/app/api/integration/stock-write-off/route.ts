import { randomUUID } from "crypto";
import { SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED } from "@era/contracts";
import { NextResponse } from "next/server";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    source?: string;
    procedureOrderId?: string;
    lines?: Array<{ sku: string; qty: number; description?: string }>;
    correlationId?: string;
  };
  const lines = body.lines ?? [];
  if (lines.length === 0) {
    return NextResponse.json({ error: "lines required" }, { status: 400 });
  }

  const amountAzn = lines.reduce((s, l) => s + l.qty, 0);
  await dispatchSatelliteEvent({
    type: SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED,
    payload: {
      ticketId: body.procedureOrderId ?? `clinic-${randomUUID()}`,
      outletId: "clinic",
      outletCode: "CLINIC",
      paymentMethod: "INTERNAL",
      amountAzn,
      currency: "AZN",
      lines,
    },
  });

  return NextResponse.json({ ok: true, lineCount: lines.length });
}
