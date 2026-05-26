import { NextResponse } from "next/server";
import { lookupLegalEntityByVoen } from "@era/satellite-kit";

export async function POST(request: Request) {
  const body = (await request.json()) as { taxId?: string };
  const taxId = body.taxId?.trim();
  if (!taxId) {
    return NextResponse.json({ error: "taxId required" }, { status: 400 });
  }
  const result = await lookupLegalEntityByVoen(taxId);
  return NextResponse.json(result);
}
