import { NextResponse } from "next/server";
import { listActiveBanquets } from "@/lib/pms-bridge-client";

export async function GET() {
  const events = await listActiveBanquets();
  return NextResponse.json(events);
}
