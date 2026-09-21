import { NextResponse } from "next/server";
import { getBuyerSession, nestBuyerFetch } from "@/lib/buyer-session";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await getBuyerSession();
    const { id } = await context.params;
    const res = await nestBuyerFetch(
      `/api/buyer/trade-credit/invoices/${id}/pay-link`,
      { method: "POST" },
    );
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status });
  }
}
