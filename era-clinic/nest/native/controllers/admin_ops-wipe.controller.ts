import { Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import { z } from "zod";
import { jsonError, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { expressKitHeaders } from "@era/satellite-kit";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { countClinicOpsWipe, runClinicOpsWipe } from "@/domain/ops/ops-wipe.service";


const confirmSchema = z.object({
  organizationId: z.string().uuid(),
  confirmPhrase: z.literal("WIPE"),
  ops: z.array(z.string()).optional(),
  catalog: z.array(z.string()).optional(),
});

async function superAdminSession() {
  const session = await getSatelliteSession();
  if (!session) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!isPlatformSuperAdminUser({ email: session.email ?? null, login: session.login })) {
    throw Object.assign(new Error("Forbidden: platform super admin only"), {
      status: 403,
    });
  }
  return session;
}





function routeError(err: unknown) {
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status?: number }).status === "number"
  ) {
    const status = (err as { status: number }).status;
    const message = err instanceof Error ? err.message : "Error";
    return clinicBody(jsonError(message, status));
  }
  return clinicBody(handleRouteError(err));
}

@Controller()
@UseGuards(ClinicApiGuard)
export class AdminOpsWipeController {

  @Get("api/admin/ops-wipe")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicStaff(httpReq, readClinicSession(httpReq), async () => {
      try {
    const session = await superAdminSession();
    return {
      organizationId: session.organizationId,
      counts: await countClinicOpsWipe(session.organizationId),
    };
  } catch (err) {
    return routeError(err);
  }

        });
  }

  @Post("api/admin/ops-wipe")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicStaff(httpReq, readClinicSession(httpReq), async () => {
      try {
    const session = await superAdminSession();
    const body = confirmSchema.parse(httpReq.body);
    if (body.organizationId !== session.organizationId) {
      throw Object.assign(
        new Error("Organization changed since counts were loaded — reload the page"),
        { status: 409 },
      );
    }
    const deleted = await runClinicOpsWipe(session.organizationId, {
      ops: body.ops,
      catalog: body.catalog,
    });
    await recordClinicAudit(
      { userId: session.sub, request: expressKitHeaders(httpReq) },
      "OpsWipe",
      session.organizationId,
      "WIPE",
      { deleted },
    );
    return {
      organizationId: session.organizationId,
      deleted,
      counts: await countClinicOpsWipe(session.organizationId),
    };
  } catch (err) {
    return routeError(err);
  }

        });
  }
}
