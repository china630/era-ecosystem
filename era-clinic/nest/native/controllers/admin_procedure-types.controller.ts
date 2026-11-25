import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Get, HttpCode, Post, Req, Res, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  nestHeader,
  withClinicStaff,
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listProcedureTypes, createProcedureType, purgeNonCabinProcedureTypes, auditMasterChange, findServiceCatalogForProcedureName } from "@/lib/services/clinic-master-data.service";
import { localizedCatalogDescription } from "@era/clinic-domain";


const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1).optional(),
  durationMin: z.number().int().positive().optional(),
  resourceGapMinutes: z.number().int().min(0).max(240).optional(),
  patientRestMinutes: z.number().int().min(0).max(240).optional(),
  resourceKind: z.enum(["ROOM", "EQUIPMENT"]).nullable().optional(),
  resourceCode: z.string().nullable().optional(),
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
  afterLunchAllowed: z.boolean().optional(),
  extendedStartHour: z.number().int().min(0).max(23).nullable().optional(),
  extendedEndHour: z.number().int().min(1).max(24).nullable().optional(),
  needsSite: z.boolean().optional(),
  openAttendance: z.boolean().optional(),
  blockCategory: z.enum(["PHYSIO", "BATH", "PARAFFIN"]).nullable().optional(),
  usageContour: z.enum(["GUEST", "INTERNAL"]).optional(),
  physioOrderFields: z.array(z.string().min(1)).optional(),
  allowedSiteCodes: z.array(z.string().min(1)).optional(),
  financeSku: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

@Controller()
export class AdminProcedureTypesController {

  @UseGuards(ClinicApiGuard)
  @Get("api/admin/procedure-types")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const deniedMaster = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.SCREEN_ADMIN_PROCEDURE_TYPES,
    );
    const deniedTemplates = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES,
    );
    const deniedRules = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.SCREEN_ADMIN_PROCEDURE_RULES,
    );
    if (deniedMaster && deniedTemplates && deniedRules) return deniedMaster;
    const locale =
      new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").searchParams.get("locale") ??
      nestHeader(httpReq, "x-era-locale") ??
      "en";
    const blockedNonCabin = await purgeNonCabinProcedureTypes();
    return {
      items: await listProcedureTypes(locale),
      blockedNonCabin,
    };
  
        });
  }

  @Post("api/admin/procedure-types")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    let name = body.name?.trim();
    if (!name) {
      const cat = await findServiceCatalogForProcedureName(body.code.trim());
      name = cat ? localizedCatalogDescription(cat, "az") : body.code.trim();
    }
    const row = await createProcedureType({ ...body, name });
    await auditMasterChange(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "procedureType",
      row.id,
      "CREATE",
      body,
    );
    throw new HttpException(row, 201);
  
        });
  }
}
