import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listNahiyeQueue } from "@/domain/physio/nahiye-cutover.service";

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const rows = await listNahiyeQueue({
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
