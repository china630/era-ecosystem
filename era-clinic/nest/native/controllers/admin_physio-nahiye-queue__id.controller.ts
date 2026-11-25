import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { aliasNahiyeQueueItem, ignoreNahiyeQueueItem } from "@/domain/physio/nahiye-cutover.service";


const patchSchema = z.object({
  action: z.enum(["ignore", "alias"]),
  siteId: z.string().min(1).optional(),
  alias: z.string().optional(),
});

@Controller()
export class AdminPhysioNahiyeQueueIdController {

  @Patch("api/admin/physio-nahiye-queue/:id")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    if (body.action === "ignore") {
      const row = await ignoreNahiyeQueueItem(id);
      await recordClinicAudit(
        { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
        "PhysioNahiyeQueue",
        id,
        "UPDATE",
        { action: "ignore" },
      );
      return row;
    }
    if (!body.siteId) {
      throw new HttpException({ error: "siteId required to add an alias" }, 400);
    }
    const row = await aliasNahiyeQueueItem(id, body.siteId, body.alias);
    await recordClinicAudit(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "PhysioNahiyeQueue",
      id,
      "UPDATE",
      { action: "alias", siteId: body.siteId },
    );
    return row;
  
        });
  }
}
