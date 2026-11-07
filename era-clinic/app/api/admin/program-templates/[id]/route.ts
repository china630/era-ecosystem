import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import {
  programTemplateWriteSchema,
  shapeProgramTemplate,
  saveProgramTemplatePatch,
  countOpenInstancesForTemplate,
  countAnyInstancesForTemplate,
} from "@/domain/sanatorium/program-template-admin";
import {
  applyOpenCourseQuotaRecalc,
  previewOpenCourseQuotaRecalc,
  publishFixedAsDailyRate,
} from "@/domain/sanatorium/package-quota-recalc-admin";

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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    try {
      if (action === "preview-recalc") {
        return jsonOk(await previewOpenCourseQuotaRecalc(id));
      }
      if (action === "apply-recalc") {
        return jsonOk(await applyOpenCourseQuotaRecalc(id));
      }
      if (action === "publish-daily") {
        const blocks = Array.isArray(body.blocks)
          ? (body.blocks as Array<{
              procedureCode: string;
              blockQuotaMode?: "DAILY_RATE" | "WEEKLY" | "PER_STAY";
              quotaPerNight?: number;
              quotaPerWeek?: number | null;
              dailyUseCap?: number | null;
              quotaTotal?: number;
            }>)
          : undefined;
        const row = await publishFixedAsDailyRate(id, {
          countSunday: body.countSunday === true,
          blocks,
        });
        const [openInstanceCount, pinInstanceCount] = await Promise.all([
          countOpenInstancesForTemplate(row.id),
          countAnyInstancesForTemplate(row.id),
        ]);
        return jsonOk({
          ...shapeProgramTemplate({ ...row, openInstanceCount, pinInstanceCount }),
          versionBumped: row.supersedesId != null,
        });
      }
      return jsonOk({ error: "UNKNOWN_ACTION" }, 400);
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (
        code === "NOT_CURRENT" ||
        code === "TEMPLATE_NOT_FOUND" ||
        code === "NOT_DAILY_RATE" ||
        code === "ALREADY_DAILY_RATE"
      ) {
        return jsonOk({ error: code }, 409);
      }
      throw e;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
