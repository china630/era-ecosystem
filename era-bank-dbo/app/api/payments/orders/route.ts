import { z } from "zod";
import { createPaymentSignRequest } from "@/lib/customer-session";
import { dboPaths, engineDboFetch, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

const createSchema = z.object({
  debitAccountId: z.string().min(1),
  beneficiaryIban: z.string().min(1),
  beneficiaryName: z.string().min(1),
  purpose: z.string().optional(),
  amountMinor: z.number().int().positive(),
});

export async function GET() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const data = await engineDboFetch(dboPaths.paymentOrders, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const idempotencyKey = request.headers.get("idempotency-key") ?? crypto.randomUUID();
    const data = await engineDboJson<{ order?: { id: string }; id?: string }>(
      "POST",
      dboPaths.paymentOrders,
      body,
      {
        customerJwt: auth.session.customerJwt ?? undefined,
        idempotencyKey,
      },
    );

    const engineOrderId = data.order?.id ?? data.id;
    if (engineOrderId && auth.session.channel === "CORPORATE") {
      await createPaymentSignRequest({
        engineOrderId,
        customerId: auth.session.customerId,
        requestedBySessionId: auth.session.id,
      });
    }

    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
