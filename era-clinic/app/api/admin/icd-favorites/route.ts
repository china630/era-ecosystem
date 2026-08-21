import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  getTenantIcdFavorites,
  retireIcdCode,
  setTenantIcdFavorites,
} from "@/domain/icd/icd-search.service";
import {
  getLocalIcd10Version,
  syncIcd10FromGatewayOrFile,
} from "@/domain/icd/icd-sync.service";

const putSchema = z.object({
  codes: z.array(z.string().min(1).max(16)).max(80),
});
const retireSchema = z.object({
  code: z.string().min(1).max(16),
});

export async function GET() {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const [codes, version] = await Promise.all([
      getTenantIcdFavorites(),
      getLocalIcd10Version(),
    ]);
    return jsonOk({ codes, version });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = putSchema.parse(await req.json());
    const tenant = await setTenantIcdFavorites(body.codes);
    return jsonOk({ codes: tenant.icdFavoriteCodes });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const action = new URL(req.url).searchParams.get("action");
    if (action === "sync") {
      return jsonOk(await syncIcd10FromGatewayOrFile());
    }
    if (action === "retire") {
      const body = retireSchema.parse(await req.json());
      const row = await retireIcdCode(body.code);
      return jsonOk({ code: row.code, active: row.active, retiredAt: row.retiredAt });
    }
    return jsonError("Unknown action", 400);
  } catch (err) {
    return handleRouteError(err);
  }
}
