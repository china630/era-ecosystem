import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, HttpCode, Put, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { applyEpisodeBroughtInBlank } from "@/domain/lab/brought-in-result";


const bodySchema = z.object({
  serviceCode: z.string().min(1),
  resultOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

@Controller()
export class SanatoriumEpisodesIdBroughtInController {

  @UseGuards(ClinicApiGuard)
  @Put("api/sanatorium/episodes/:id/brought-in")
  @HttpCode(200)
  async put_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const body = bodySchema.parse(httpReq.body);
    const result = await applyEpisodeBroughtInBlank({
      episodeId: id,
      serviceCode: body.serviceCode,
      resultOn: body.resultOn,
      cancelOpenOrdersUserId: session.sub,
      request: expressKitHeaders(httpReq),
    });
    if (!result.ok) {
      if (result.kind === "EPISODE_NOT_FOUND") throw new HttpException({ error: "Episode not found" }, 404);
      if (result.kind === "NOT_ACCEPTED") {
        throw new HttpException({ error: "This lab does not accept a brought-in blank" }, 400);
      }
      throw new HttpException({ error: "Brought-in blank is outside the accepted window" }, 400);
    }
    return {
      serviceCode: result.serviceCode,
      resultOn: result.resultOn,
      cancelledOrderIds: result.cancelledOrderIds,
      restoredOrderId: result.restoredOrderId,
      edited: result.edited,
    };
  
        });
  }
}
