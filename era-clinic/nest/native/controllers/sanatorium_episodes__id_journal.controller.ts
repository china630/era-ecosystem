import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  nestQuery,
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { listEpisodeJournal } from "@/domain/sanatorium/episode-audit.service";
import { findEpisodeOrganizationId } from "@/domain/sanatorium/episode-resolve";

@Controller()
export class SanatoriumEpisodesIdJournalController {

  @UseGuards(ClinicApiGuard)
  @Get("api/sanatorium/episodes/:id/journal")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
          const query = nestQuery(httpReq);
          if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
          const denied = await requireClinicPermission(
            session,
            CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
          );
          if (denied) return clinicBody(denied);
          const { id } = httpReq.params;
          const episode = await findEpisodeOrganizationId(id);
          if (!episode) throw new HttpException({ error: "Episode not found" }, 404);
          const scopeDenied = await assertEpisodeDataScope(session, id);
          if (scopeDenied) return clinicBody(scopeDenied);
          const limitRaw = query.get("limit");
          const limit = Math.min(Math.max(Number(limitRaw) || 100, 1), 200);
          const items = await listEpisodeJournal(id, limit);
          return {
            items: items.map((row) => ({
              ...row,
              createdAt:
                row.createdAt instanceof Date
                  ? row.createdAt.toISOString()
                  : row.createdAt,
            })),
          };
        });
  }
}
