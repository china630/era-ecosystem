import { z } from "zod";
import { financeVoenLookup } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

const querySchema = z.object({
  voen: z.string().min(10).max(10),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = querySchema.parse({
      voen: (url.searchParams.get("voen") ?? "").replace(/\D/g, ""),
    });
    const result = await financeVoenLookup(params.voen, {
      authHeader: req.headers.get("authorization"),
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
