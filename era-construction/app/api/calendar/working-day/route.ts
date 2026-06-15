import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { isConstructionWorkingDay, constructionSlaDueDate } from "@/lib/production-calendar";

const dateQuery = z.object({ date: z.string() });
const slaQuery = z.object({
  from: z.string(),
  days: z.coerce.number().int().min(0).max(90),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");
    if (mode === "sla") {
      const params = slaQuery.parse({
        from: url.searchParams.get("from"),
        days: url.searchParams.get("days") ?? "1",
      });
      const due = await constructionSlaDueDate(params.from, params.days);
      return jsonOk({ from: params.from, businessDays: params.days, due, source: "era-data-hub" });
    }
    const params = dateQuery.parse({ date: url.searchParams.get("date") });
    const isWorking = await isConstructionWorkingDay(params.date);
    return jsonOk({ date: params.date, isWorking, source: "era-data-hub" });
  } catch (err) {
    return handleRouteError(err);
  }
}
