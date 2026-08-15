import { NextResponse } from "next/server";

/** Ops notification feed — empty until bank-core emits staff alerts. */
export async function GET() {
  return NextResponse.json({ items: [], unreadCount: 0 });
}

export async function PATCH() {
  return NextResponse.json({ ok: true });
}
