import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  listAnalytes,
  createAnalyte,
} from "@/domain/catalog/diagnostic-catalog-admin.service";

const createSchema = z.object({
  code: z.string().min(1),
  unit: z.string().nullable().optional(),
  labelEn: z.string().min(1),
  labelRu: z.string().min(1),
  labelAz: z.string().min(1),
  refMin: z.string().nullable().optional(),
  refMax: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
  valueType: z.enum(["NUMERIC", "QUALITATIVE"]).optional(),
  sortOrder: z.number().int().optional(),
  valueOptions: z
    .array(
      z.object({
        code: z.string().min(1),
        labelEn: z.string().min(1),
        labelRu: z.string().min(1),
        labelAz: z.string().min(1),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    return jsonOk(await listAnalytes(id));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = createSchema.parse(await req.json());
    const row = await createAnalyte(
      { userId: guard.session.sub, request: req },
      id,
      body,
    );
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
