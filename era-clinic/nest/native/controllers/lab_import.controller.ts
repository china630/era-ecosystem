import { Controller, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertOpsApiPermission } from "@/lib/auth/clinic-ops-guard";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { createImportedLabOrder } from "@/domain/lab/lab-order-write.service";


const MAX_EXTERNAL_AGE_DAYS = 90;

const bodySchema = z.object({
  patientRefId: z.string(),
  testCode: z.string(),
  results: z.array(
    z.object({
      analyte: z.string(),
      value: z.string(),
      refMin: z.number().optional(),
      refMax: z.number().optional(),
      flag: z.string().optional(),
    }),
  ),
  source: z.enum(["IN_HOUSE", "EXTERNAL"]).default("EXTERNAL"),
  resultDate: z.string().min(1),
});

/** Legacy alias of /api/lab-orders/import — create/results need api:lab_orders.write. */

@Controller()
export class LabImportController {

  @Post("api/lab/import")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const gate = await assertOpsApiPermission(clinicRoute(httpReq), CLINIC_PERMISSION.API_LAB_ORDERS_WRITE);
    if (gate.error) return clinicBody(gate.error);

    const body = bodySchema.parse(httpReq.body);
    const resultDate = new Date(body.resultDate);
    if (Number.isNaN(resultDate.getTime())) {
      throw new HttpException({ error: "Invalid resultDate" }, 400);
    }
    const ageMs = Date.now() - resultDate.getTime();
    if (ageMs > MAX_EXTERNAL_AGE_DAYS * 24 * 60 * 60 * 1000) {
      throw new HttpException({ error: 
        `External lab results older than ${MAX_EXTERNAL_AGE_DAYS} days are not accepted` }, 400);
    }
    if (ageMs < -24 * 60 * 60 * 1000) {
      throw new HttpException({ error: "resultDate cannot be in the future" }, 400);
    }

    const order = await createImportedLabOrder({
      patientRefId: body.patientRefId,
      code: body.testCode,
      results: body.results,
      source: body.source,
      resultDate,
    });
    throw new HttpException({ orderId: order.id, imported: body.results.length }, 201);
  
        });
  }
}
