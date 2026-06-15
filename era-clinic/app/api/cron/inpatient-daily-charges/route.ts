import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { postDailyWardCharges } from "@/domain/inpatient/daily-charge.service";

const CRON_SECRET = process.env.PLATFORM_CRON_SECRET ?? "";

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const chargeDate = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
    return jsonOk(await postDailyWardCharges(chargeDate));
  } catch (err) {
    return handleRouteError(err);
  }
}
