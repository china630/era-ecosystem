import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  listModalities,
  createModality,
} from "@/domain/catalog/diagnostic-catalog-admin.service";

const createSchema = z.object({
  code: z.string().min(1),
  kind: z.string().min(1),
  titleEn: z.string().min(1),
  titleRu: z.string().min(1),
  titleAz: z.string().min(1),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const includeInactive =
      new URL(req.url).searchParams.get("includeInactive") === "true";
    return jsonOk(await listModalities({ includeInactive }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const row = await createModality(
      { userId: guard.session.sub, request: req },
      body,
    );
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
