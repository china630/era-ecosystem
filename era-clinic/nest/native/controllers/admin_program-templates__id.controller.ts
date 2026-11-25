import { Controller, HttpCode, Patch, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { programTemplateWriteSchema, shapeProgramTemplate, saveProgramTemplatePatch, countOpenInstancesForTemplate, countAnyInstancesForTemplate } from "@/domain/sanatorium/program-template-admin";
import { applyOpenCourseQuotaRecalc, previewOpenCourseQuotaRecalc, publishFixedAsDailyRate } from "@/domain/sanatorium/package-quota-recalc-admin";

@Controller()
export class AdminProgramTemplatesIdController {

  @Patch("api/admin/program-templates/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = programTemplateWriteSchema.parse(httpReq.body);

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
      return {
        ...shapeProgramTemplate({ ...row, openInstanceCount, pinInstanceCount }),
        versionBumped: row.supersedesId != null,
        previousVersionOpenStays: previousOpen,
      };
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (code === "NOT_FOUND") throw new HttpException({ error: "NOT_FOUND" }, 404);
      if (code === "RETIRED_TEMPLATE") {
        throw new HttpException({ error: "RETIRED_TEMPLATE", message: "Edit the current version only" }, 409);
      }
      if (code === "INVALID_VALIDITY_RANGE") {
        throw new HttpException({
            error: "INVALID_VALIDITY_RANGE",
            message: "Valid-to must not precede valid-from",
          }, 400);
      }
      if (code === "COMPOSITION_REQUIRES_PROCEDURES") {
        throw new HttpException({
            error: "COMPOSITION_REQUIRES_PROCEDURES",
            message: "Send procedures with knots when changing composition",
          }, 400);
      }
      throw e;
    }
  
        });
  }

  @Post("api/admin/program-templates/:id")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const action = url.searchParams.get("action");
    const body = ((httpReq.body ?? {})) as Record<string, unknown>;

    try {
      if (action === "preview-recalc") {
        return await previewOpenCourseQuotaRecalc(id);
      }
      if (action === "apply-recalc") {
        return await applyOpenCourseQuotaRecalc(id);
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
        return {
          ...shapeProgramTemplate({ ...row, openInstanceCount, pinInstanceCount }),
          versionBumped: row.supersedesId != null,
        };
      }
      throw new HttpException({ error: "UNKNOWN_ACTION" }, 400);
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (
        code === "NOT_CURRENT" ||
        code === "TEMPLATE_NOT_FOUND" ||
        code === "NOT_DAILY_RATE" ||
        code === "ALREADY_DAILY_RATE"
      ) {
        throw new HttpException({ error: code }, 409);
      }
      throw e;
    }
  
        });
  }
}
