import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { listInHouseGuests } from "@/lib/pms-bridge-client";

export async function GET(request: Request) {
  await assertFnbEntitled();
  const query = new URL(request.url).searchParams.get("query") ?? undefined;
  const guests = await listInHouseGuests(query);
  return NextResponse.json(guests);
}
