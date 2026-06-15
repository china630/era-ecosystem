import { z } from "zod";
import { financeFxPreview } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

const querySchema = z.object({
  from: z.string().min(3),
  amount: z.coerce.number().min(0),
  to: z.string().optional(),
  date: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = querySchema.parse({
      from: url.searchParams.get("from"),
      amount: url.searchParams.get("amount") ?? "100",
      to: url.searchParams.get("to") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
    });
    const preview = await financeFxPreview(params, {
      authHeader: req.headers.get("authorization"),
    });
    return jsonOk(preview);
  } catch (err) {
    return handleRouteError(err);
  }
}
