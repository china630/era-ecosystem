import { z } from "zod";
import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

const schema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  purpose: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const idempotencyKey = request.headers.get("idempotency-key") ?? crypto.randomUUID();

    const data = await engineDboJson("POST", dboPaths.transfersInternal, body, {
      customerJwt: auth.session.customerJwt ?? undefined,
      idempotencyKey,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
