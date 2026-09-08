import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function orchApiBase(): string {
  return (process.env.ORCH_API_INTERNAL_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
}

/** Same-origin proxy so the storefront does not depend on CORS to the public API host. */
export async function GET() {
  try {
    const res = await fetch(`${orchApiBase()}/v1/public/pricing`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ unavailable: true }, { status: 200 });
    }
    const body: unknown = await res.json();
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ unavailable: true }, { status: 200 });
  }
}
