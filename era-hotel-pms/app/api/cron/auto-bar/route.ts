import { applyAutoBar } from "@/lib/services/auto-bar-engine.service";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

/** Nightly auto-BAR job — respects MANUAL locks. */
export async function POST(req: Request) {
  try {
    const secret = process.env.HOTEL_CRON_SECRET?.trim();
    if (secret) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${secret}`) {
        return new Response("Unauthorized", { status: 401 });
      }
    }
    const today = new Date();
    const from = new Date(today.toISOString().slice(0, 10));
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 90);
    const result = await applyAutoBar({ from, to });
    return jsonOk({ ...result, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  } catch (err) {
    return handleRouteError(err);
  }
}
