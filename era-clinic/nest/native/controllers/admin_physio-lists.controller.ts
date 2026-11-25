import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { createPhysioListItem, listPhysioListItems } from "@/domain/physio/physio-catalog.service";
import { isPhysioListKind } from "@/domain/physio/physio-catalog";


const createSchema = z.object({
  listKind: z.enum(["DEVICE_PROGRAM", "SUBSTANCE"]),
  code: z.string().min(1),
  titleAz: z.string().min(1),
  titleRu: z.string().min(1),
  titleEn: z.string().min(1),
  sortOrder: z.number().int().optional(),
  aliases: z.array(z.string()).optional(),
});

@Controller()
export class AdminPhysioListsController {

  @Get("api/admin/physio-lists")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const kindRaw = url.searchParams.get("kind") ?? "";
    if (!isPhysioListKind(kindRaw)) {
      throw new HttpException({ error: "kind=DEVICE_PROGRAM|SUBSTANCE is required" }, 400);
    }
    const rows = await listPhysioListItems(kindRaw, {
      q: url.searchParams.get("q") ?? undefined,
      activeOnly: url.searchParams.get("activeOnly") === "1",
    });
    return rows;
  
        });
  }

  @Post("api/admin/physio-lists")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const guard = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (guard.error) return clinicBody(guard.error);
    const body = createSchema.parse(httpReq.body);
    const row = await createPhysioListItem(body);
    await recordClinicAudit(
      { userId: guard.session.sub, request: expressKitHeaders(httpReq) },
      "PhysioListItem",
      row.id,
      "CREATE",
      { listKind: row.listKind, code: row.code },
    );
    throw new HttpException(row, 201);
  
        });
  }
}
