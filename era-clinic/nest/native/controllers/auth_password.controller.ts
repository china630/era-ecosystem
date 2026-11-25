import { Controller, HttpCode, Patch, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { changeLocalPassword, LocalPasswordError, LOCAL_PASSWORD_MIN_LENGTH } from "@/lib/change-local-password";


const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(LOCAL_PASSWORD_MIN_LENGTH),
});

@Controller()
export class AuthPasswordController {

  @UseGuards(ClinicApiGuard)
  @Patch("api/auth/password")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  try {
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const body = schema.parse(httpReq.body);
    await changeLocalPassword({
      userId: session.sub,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof LocalPasswordError) {
      throw new HttpException({ error: err.message }, err.status);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
