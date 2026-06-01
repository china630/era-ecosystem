import { NextResponse } from "next/server";
import { z } from "zod";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

const itemSchema = z.object({
  id: z.string(),
  kind: z.enum(["pay", "fire"]),
  ticketId: z.string(),
  payload: z.record(z.unknown()),
});

const bodySchema = z.object({
  actions: z.array(itemSchema).min(1).max(50),
});

/** Replay queued pay/fire from offline client. */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.WAITER, FB_ROLES.MANAGER]);
  if (denied) return denied;

  const { actions } = bodySchema.parse(await request.json());
  const origin = new URL(request.url).origin;
  const results: { id: string; ok: boolean; status: number }[] = [];

  for (const action of actions) {
    const path =
      action.kind === "pay"
        ? `/api/tickets/${action.ticketId}/pay`
        : `/api/tickets/${action.ticketId}/fire`;
    const res = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify(action.payload),
    });
    results.push({ id: action.id, ok: res.ok, status: res.status });
  }

  return NextResponse.json({ replayed: results.length, results });
}
