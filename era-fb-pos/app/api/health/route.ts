import { NextResponse } from "next/server";
import { isPmsStubMode } from "@/lib/pms-bridge-client";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "era-fb-pos",
    pmsStub: isPmsStubMode(),
  });
}
