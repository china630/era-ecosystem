import { NextResponse } from "next/server";

/** Service-token cron stub for catalog sync (delegates to admin sync). */
export async function POST(req: Request) {
  const secret = process.env.PLATFORM_CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = process.env.ERA_CLINIC_URL ?? "http://127.0.0.1:3203";
  const res = await fetch(`${base.replace(/\/$/, "")}/api/catalog/sync`, {
    method: "POST",
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
