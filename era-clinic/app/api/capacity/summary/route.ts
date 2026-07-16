import { NextResponse } from "next/server";
import {
  evaluateAndPublishCapacity,
  getCapacitySummary,
} from "@/lib/capacity.service";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function authorize(request: Request): boolean {
  const secret = request.headers.get("x-clinic-bridge-secret");
  const expected = process.env.CLINIC_BRIDGE_SECRET;
  return Boolean(expected && secret === expected);
}

export async function GET(request: Request) {
  if (!authorize(request)) return unauthorized();
  const url = new URL(request.url);
  const ref = url.searchParams.get("date");
  const refDate = ref ? new Date(ref) : new Date();
  const summary = await getCapacitySummary(refDate);
  return NextResponse.json(summary);
}

/** Evaluate + publish bus event when risk level changes (cron / hotel sync). */
export async function POST(request: Request) {
  if (!authorize(request)) return unauthorized();
  const url = new URL(request.url);
  const ref = url.searchParams.get("date");
  const refDate = ref ? new Date(ref) : new Date();
  const result = await evaluateAndPublishCapacity(refDate);
  return NextResponse.json(result);
}
