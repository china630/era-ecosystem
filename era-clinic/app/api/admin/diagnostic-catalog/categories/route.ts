import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  listDiagnosticCategories,
  createDiagnosticCategory,
} from "@/domain/catalog/diagnostic-catalog-admin.service";

const createSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    return jsonOk(await listDiagnosticCategories());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const row = await createDiagnosticCategory(
      { userId: guard.session.sub, request: req },
      body.name,
      body.active,
    );
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
