import { Controller, Get, HttpCode, Patch, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { patchProcedureOrderPhysio, toPhysioOrderPayload } from "@/domain/physio/physio-order-sites.service";
import { getProcedureOrderCard } from "@/domain/procedure/procedure-order-card.service";


const patchSchema = z.object({
  bodyPart: z
    .enum([
      "HEAD",
      "NECK",
      "CHEST",
      "BACK",
      "ABDOMEN",
      "ARM_LEFT",
      "ARM_RIGHT",
      "LEG_LEFT",
      "LEG_RIGHT",
      "FULL_BODY",
    ])
    .nullable()
    .optional(),
  siteIds: z.array(z.string().min(1)).optional(),
  siteApplyMode: z.enum(["TOGETHER", "TURN"]).nullable().optional(),
  siteLaterality: z.record(z.enum(["LEFT", "RIGHT", "BOTH"]).nullable()).optional(),
  physioFields: z.record(z.unknown()).nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
});

/** Reception card for one scheduled procedure (matrix click). */


/** Patch PROPOSED/SCHEDULED order: S chips, type-gated fields, note. */

@Controller()
export class ProceduresIdController {

  @UseGuards(ClinicApiGuard)
  @Get("api/procedures/:id")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_READ);
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const card = await getProcedureOrderCard(id);
    if (!card) throw new HttpException({ error: "Not found" }, 404);
    return card;
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Patch("api/procedures/:id")
  @HttpCode(200)
  async patch_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_DOCTOR_RECEPTION);
    if (denied) return clinicBody(denied);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const updated = await patchProcedureOrderPhysio(id, body);
    return {
      ...updated,
      physio: toPhysioOrderPayload(updated),
    };
  
        });
  }
}
