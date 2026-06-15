import { dboPaths, engineDboJson } from "@/lib/engine-dbo-client";
import {
  clearSessionCookie,
  handleRouteError,
  jsonOk,
  requireCustomerSession,
} from "@/lib/api-utils";
import { revokeCustomerSession } from "@/lib/customer-session";

export async function POST() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    if (auth.session.customerJwt) {
      await engineDboJson("POST", dboPaths.authLogout, undefined, {
        customerJwt: auth.session.customerJwt,
      }).catch(() => undefined);
    }

    await revokeCustomerSession(auth.session.id);
    const res = jsonOk({ ok: true });
    clearSessionCookie(res);
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
