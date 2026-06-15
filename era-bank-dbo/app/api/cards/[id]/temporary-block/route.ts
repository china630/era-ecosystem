import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const data = await engineDboJson("POST", dboPaths.cardTemporaryBlock(id), undefined, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
