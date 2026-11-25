import { Controller, Get, HttpCode, Req, Res, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  nestQuery,
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { jsonError } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { sessionHasAnyClinicPermission } from "@/lib/auth/clinic-permission-check";
import { getProcedureLoadMatrix } from "@/domain/planning/procedure-load.service";

@Controller()
export class SanatoriumProcedureLoadController {

  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/procedure-load")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
          if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
          // Resources board + package-assign modal both call this heat API.
          if (
            !sessionHasAnyClinicPermission(session, [
              CLINIC_PERMISSION.API_SANATORIUM_RESOURCES,
              CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
            ])
          ) {
            return clinicBody(jsonError("Forbidden", 403, { code: "FORBIDDEN" }));
          }
          const query = nestQuery(httpReq);
          const fromYmd = query.get("from") ?? undefined;
          const toYmd = query.get("to") ?? undefined;
          const topRaw = query.get("top");
          const topN = topRaw ? Number(topRaw) : 10;
          const bypassCache = query.has("bust");
          const matrix = await getProcedureLoadMatrix({
            fromYmd: fromYmd || undefined,
            toYmd: toYmd || undefined,
            topN: Number.isFinite(topN) ? topN : 10,
            bypassCache,
          });
          return { data: matrix };
        });
  }
}
