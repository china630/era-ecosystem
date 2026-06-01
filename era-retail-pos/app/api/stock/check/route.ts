import { z } from "zod";
import { financeStockCheck } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

const bodySchema = z.object({
  sku: z.string().min(1),
  warehouseId: z.string().optional(),
  actualQty: z.number().min(0).optional(),
  barcode: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const authHeader = req.headers.get("authorization");
    const result = await financeStockCheck(body, { authHeader });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
