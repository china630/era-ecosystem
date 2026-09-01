import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  listServices,
  createService,
} from "@/domain/catalog/diagnostic-catalog-admin.service";

const fieldDefSchema = z.object({
  key: z.string().min(1),
  type: z.string().min(1),
  label: z.object({ en: z.string(), ru: z.string(), az: z.string() }),
  unit: z.string().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

const createSchema = z.object({
  code: z.string().min(1),
  modalityId: z.string().min(1),
  category: z.string().optional(),
  kind: z.string().min(1),
  titleEn: z.string().min(1),
  titleRu: z.string().min(1),
  titleAz: z.string().min(1),
  serviceCode: z.string().min(1),
  fields: z.array(fieldDefSchema).nullable().optional(),
  includes: z.array(z.string()).nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const modalityId = url.searchParams.get("modalityId") ?? undefined;
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    return jsonOk(await listServices({ modalityId, includeInactive }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    const row = await createService(
      { userId: guard.session.sub, request: req },
      body,
    );
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
