import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { nextServiceAppointmentDay } from "@/lib/production-calendar";

const querySchema = z.object({ from: z.string().optional() });

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = querySchema.parse({ from: url.searchParams.get("from") ?? undefined });
    const from = params.from ?? new Date().toISOString().slice(0, 10);
    const nextDay = await nextServiceAppointmentDay(from);
    return jsonOk({ from, nextWorkingDay: nextDay, source: "era-data-hub" });
  } catch (err) {
    return handleRouteError(err);
  }
}
