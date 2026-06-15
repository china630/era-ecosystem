import { dboPaths, engineDboFetch } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const query = url.searchParams.toString();
    const path = query
      ? `${dboPaths.accountStatement(id)}?${query}`
      : dboPaths.accountStatement(id);

    const data = await engineDboFetch(path, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
