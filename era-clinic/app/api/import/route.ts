import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { listImportEntities } from "@/lib/import/adapters";
import { assertClinicImportAccess } from "@/lib/import/auth";

export async function GET(req: Request) {
  try {
    const access = await assertClinicImportAccess(req);
    if (access.error) return access.error;
    return jsonOk(listImportEntities());
  } catch (err) {
    return handleRouteError(err);
  }
}
