import { NextResponse } from "next/server";
import { getCapacitySummary } from "@/lib/capacity.service";

export async function GET(request: Request) {
  const secret = request.headers.get("x-clinic-bridge-secret");
  const expected = process.env.CLINIC_BRIDGE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const ref = url.searchParams.get("date");
  const refDate = ref ? new Date(ref) : new Date();
  const summary = await getCapacitySummary(refDate);
  return NextResponse.json(summary);
}
