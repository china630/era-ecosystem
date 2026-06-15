import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const idempotencyKey =
      request.headers.get("idempotency-key") ?? `dbo-submit-${id}`;

    const data = await engineDboJson("POST", dboPaths.paymentOrderSubmit(id), undefined, {
      customerJwt: auth.session.customerJwt ?? undefined,
      idempotencyKey,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
