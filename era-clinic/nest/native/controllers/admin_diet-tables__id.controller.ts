import { Controller, HttpCode, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import { withClinicHttp, clinicRoute, clinicBody } from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { patchDietTable } from "@/domain/diet/diet.service";
import { z } from "zod";

const patchSchema = z
  .object({
    titleAz: z.string().min(1).optional(),
    titleRu: z.string().min(1).optional(),
    titleEn: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty patch" });

@Controller()
export class AdminDietTablesIdController {
  @Patch("api/admin/diet-tables/:id")
  @HttpCode(200)
  async patch(@Req() httpReq: Request) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
      if (guard.error) return clinicBody(guard.error);
      const body = patchSchema.parse(httpReq.body);
      const row = await patchDietTable(httpReq.params.id, body);
      return { data: row };
    });
  }
}