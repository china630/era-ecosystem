import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { wholesaleTermDueDate } from "@/lib/production-calendar";

const querySchema = z.object({
  from: z.string(),
  days: z.coerce.number().int().min(0).max(365),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = querySchema.parse({
      from: url.searchParams.get("from"),
      days: url.searchParams.get("days") ?? "30",
    });
    const dueDate = await wholesaleTermDueDate(params.from, params.days);
    return jsonOk({
      from: params.from,
      paymentTermDays: params.days,
      dueDate,
      source: "era-data-hub",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
