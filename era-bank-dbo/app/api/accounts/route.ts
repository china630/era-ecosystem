import { dboPaths, engineDboFetch } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

export async function GET() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const data = await engineDboFetch(dboPaths.accounts, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
