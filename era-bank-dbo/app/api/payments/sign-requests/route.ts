import { listPendingSignRequests } from "@/lib/customer-session";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

export async function GET() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const items = await listPendingSignRequests(auth.session.customerId);
    return jsonOk({ items });
  } catch (err) {
    return handleRouteError(err);
  }
}
