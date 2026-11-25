import { Controller, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  withClinicHttp,
} from "../../bridge";
import { z } from 'zod';

import { validateProcedureCompatibility } from '@/lib/procedure-compatibility.service';


const schema = z.object({
  procedureCode: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  existing: z.array(
    z.object({
      procedureCode: z.string(),
      startAt: z.coerce.date(),
      endAt: z.coerce.date(),
    }),
  ),
});

function verifyInternalToken(request: Request): boolean {
  const token =
    process.env.CLINIC_INTERNAL_SERVICE_TOKEN?.trim() ||
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== 'production';
  const auth = nestHeader(request, 'authorization');
  return auth === `Bearer ${token}`;
}

@Controller()
export class InternalV1ProcedureValidateController {

  @Post("api/internal/v1/procedure-validate")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      if (!verifyInternalToken(httpReq)) {
    throw new HttpException({ error: 'Unauthorized' }, 401);
  }
  try {
    const body = schema.parse(httpReq.body);
    const violations = await validateProcedureCompatibility({
      candidateCode: body.procedureCode,
      startAt: body.startAt,
      endAt: body.endAt,
      existing: body.existing,
    });
    return { ok: violations.length === 0, violations };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Validation failed';
    throw new HttpException({ error: message }, 400);
  }

        });
  }
}
