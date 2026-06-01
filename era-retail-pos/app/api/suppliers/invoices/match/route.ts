import { z } from "zod";
import { financeSupplierMatch } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

const bodySchema = z.object({
  invoiceRef: z.string().min(1),
  purchaseTransactionId: z.string().uuid().optional(),
  counterpartyId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const result = await financeSupplierMatch(body, {
      authHeader: req.headers.get("authorization"),
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
