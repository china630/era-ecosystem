/** Lifted from nest/generated/kds_lines__lineId.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { findTicketLineById, updateTicketLineKitchenStatus } from "@/lib/kds.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  kitchenStatus: z.enum(["IN_PREP", "DONE"]),
});


@Controller()
export class KdsLinesLineIdController {
  @Patch("api/kds/lines/:lineId")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.KDS_BUMP);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    await requireFnbSubmodule("fnb_kitchen_kds", session?.organizationId);

    const { lineId } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);

    const line = await findTicketLineById(lineId);
    if (!line) {
      return sendJson(httpRes, { error: "Line not found" }, 404);
    }
    if (!["FIRED", "IN_PREP"].includes(line.kitchenStatus)) {
      return sendJson(httpRes, 
        { error: "Line must be FIRED or IN_PREP to bump" }, 400);
    }

    const updated = await updateTicketLineKitchenStatus(
      lineId,
      body.kitchenStatus,
    );

    return sendJson(httpRes, updated);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
