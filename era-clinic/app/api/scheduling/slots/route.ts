import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { getAvailableSlots } from "@/lib/scheduling.service";

const querySchema = z.object({
  practitionerCode: z.string().optional(),
  resourceCode: z.string().optional(),
  date: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = querySchema.parse({
      practitionerCode: url.searchParams.get("practitionerCode") ?? undefined,
      resourceCode: url.searchParams.get("resourceCode") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
    });

    const day = query.date ? new Date(query.date) : new Date();
    const slotsResult = await getAvailableSlots({
      date: day,
      practitionerCode: query.practitionerCode,
      resourceCode: query.resourceCode,
    });

    return jsonOk({
      date: day.toISOString().slice(0, 10),
      practitionerCode: query.practitionerCode ?? null,
      resourceCode: query.resourceCode ?? null,
      slotMinutes: slotsResult.slotMinutes,
      slots: slotsResult.slots,
      meta: slotsResult.meta,
      source: "scheduling",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
