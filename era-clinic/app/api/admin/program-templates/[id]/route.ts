import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  programTemplateWriteSchema,
  shapeProgramTemplate,
  saveProgramTemplatePatch,
  countOpenInstancesForTemplate,
  countAnyInstancesForTemplate,
} from "@/domain/sanatorium/program-template-admin";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = programTemplateWriteSchema.parse(await req.json());

    try {
      const row = await saveProgramTemplatePatch(id, body);
      const [openInstanceCount, pinInstanceCount] = await Promise.all([
        countOpenInstancesForTemplate(row.id),
        countAnyInstancesForTemplate(row.id),
      ]);
      const previousOpen =
        row.supersedesId != null
          ? await countOpenInstancesForTemplate(row.supersedesId)
          : 0;
      return jsonOk({
        ...shapeProgramTemplate({ ...row, openInstanceCount, pinInstanceCount }),
        versionBumped: row.supersedesId != null,
        previousVersionOpenStays: previousOpen,
      });
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (code === "NOT_FOUND") return jsonOk({ error: "NOT_FOUND" }, 404);
      if (code === "RETIRED_TEMPLATE") {
        return jsonOk(
          { error: "RETIRED_TEMPLATE", message: "Edit the current version only" },
          409,
        );
      }
      if (code === "INVALID_VALIDITY_RANGE") {
        return jsonOk(
          {
            error: "INVALID_VALIDITY_RANGE",
            message: "Valid-to must not precede valid-from",
          },
          400,
        );
      }
      if (code === "COMPOSITION_REQUIRES_PROCEDURES") {
        return jsonOk(
          {
            error: "COMPOSITION_REQUIRES_PROCEDURES",
            message: "Send procedures with knots when changing composition",
          },
          400,
        );
      }
      throw e;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
