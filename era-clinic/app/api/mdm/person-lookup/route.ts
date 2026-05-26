import { NextResponse } from "next/server";
import { lookupGlobalPersonByFin } from "@era/satellite-kit";

export async function POST(request: Request) {
  const body = (await request.json()) as { fin?: string };
  const fin = body.fin?.trim();
  if (!fin) {
    return NextResponse.json({ error: "fin required" }, { status: 400 });
  }
  const result = await lookupGlobalPersonByFin(fin);
  return NextResponse.json(result);
}
