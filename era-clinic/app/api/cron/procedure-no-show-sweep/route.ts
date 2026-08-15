import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { sweepNoShowScheduled } from "@/domain/procedure/procedure-day-close.service";

const CRON_SECRET = process.env.PLATFORM_CRON_SECRET ?? "";

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    return jsonOk(await sweepNoShowScheduled());
  } catch (err) {
    return handleRouteError(err);
  }
}
