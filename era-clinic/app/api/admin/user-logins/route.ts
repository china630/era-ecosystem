import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listUserLogins } from "@/domain/auth/user-login.service";

export async function GET(req: Request) {
  try {
    const gate = await assertClinicAdminRoute(req);
    if (gate.error) return gate.error;
    const url = new URL(req.url);
    const rows = await listUserLogins({
      organizationId: gate.session.organizationId,
      q: url.searchParams.get("q") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
