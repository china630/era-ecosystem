import { z } from "zod";
import { financeHsTariffPreview } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

const querySchema = z.object({
  code: z.string().min(4),
  date: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = querySchema.parse({
      code: url.searchParams.get("code") ?? "",
      date: url.searchParams.get("date") ?? undefined,
    });
    const preview = await financeHsTariffPreview(
      { hsCode: params.code, date: params.date },
      { authHeader: req.headers.get("authorization") },
    );
    return jsonOk(preview);
  } catch (err) {
    return handleRouteError(err);
  }
}
