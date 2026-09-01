import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  listMetaFields,
  createMetaField,
} from "@/domain/catalog/diagnostic-catalog-admin.service";

const createSchema = z.object({
  key: z.string().min(1),
  fieldType: z.string().min(1),
  labelEn: z.string().min(1),
  labelRu: z.string().min(1),
  labelAz: z.string().min(1),
  unit: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    return jsonOk(await listMetaFields());
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const row = await createMetaField(
      { userId: guard.session.sub, request: req },
      body,
    );
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
