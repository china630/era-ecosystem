import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { linkPersonIdentity } from "@era/satellite-kit";
import { buildMdmPersonLookupBody } from "@/lib/mdm-person-lookup-body";


const schema = z
  .object({
    fin: z.string().trim().optional(),
    passport: z.string().trim().optional(),
    issuingCountry: z.string().trim().optional(),
    firstName: z.string().trim().optional(),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    nationality: z.string().trim().optional(),
  })
  .refine(
    (d) =>
      Boolean(d.fullName?.trim()) ||
      Boolean(d.firstName?.trim() && d.lastName?.trim()),
    { message: "fullName or firstName+lastName required" },
  );

@Controller()
export class MdmPersonLookupController {

  @UseGuards(ClinicApiGuard)
  @Post("api/mdm/person-lookup")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_MDM_READ);
    if (denied) return clinicBody(denied);

    const parsed = schema.safeParse(httpReq.body);
    if (!parsed.success) {
      throw new HttpException({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, 400);
    }
    const linked = await linkPersonIdentity(buildMdmPersonLookupBody(parsed.data));
    return linked;
  
        });
  }
}
