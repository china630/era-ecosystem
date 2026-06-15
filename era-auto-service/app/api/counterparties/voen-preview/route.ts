import { z } from "zod";
import { financeVoenLookup } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const voen = (url.searchParams.get("voen") ?? "").replace(/\D/g, "");
    z.string().length(10).parse(voen);
    const result = await financeVoenLookup(voen, {
      authHeader: req.headers.get("authorization"),
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
