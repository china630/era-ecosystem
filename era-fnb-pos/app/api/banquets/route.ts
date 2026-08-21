import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { listActiveBanquets } from "@/lib/pms-bridge-client";

export async function GET() {
  await assertFnbEntitled();
  const events = await listActiveBanquets();
  return NextResponse.json(events);
}
