import { Controller, Get, HttpCode, Req, Res, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request, Response } from "express";
import {
  sendJson,
  withClinicStaff,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertLabOrderDataScope } from "@/lib/auth/clinic-data-scope";
import { findLabOrderFileMeta } from "@/domain/lab/lab-order-write.service";
import { readStoredLabFile } from "@/lib/import/lab-import-files";


function storedPathFromResultJson(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { storedPath?: string };
    return parsed.storedPath || null;
  } catch {
    return null;
  }
}

function contentTypeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

@Controller()
export class LabOrdersIdFileController {

  @UseGuards(ClinicApiGuard)
  @Get("api/lab-orders/:id/file")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
    @Res({ passthrough: false }) httpRes: Response,
  ) {
    const session = readClinicSession(httpReq);
    await withClinicStaff(httpReq, session, async () => {


  
    if (!session) { sendJson(httpRes, { error: "Unauthorized" }, 401); return; }
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_FILE);
    if (denied) return denied;

    const { id } = httpReq.params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const order = await findLabOrderFileMeta(id);
    if (!order) { sendJson(httpRes, { error: "Lab order not found" }, 404); return; }
    const storedPath = storedPathFromResultJson(order.resultJson);
    if (!storedPath) { sendJson(httpRes, { error: "Lab file not imported" }, 404); return; }
    const file = readStoredLabFile(storedPath);
    if (!file) { sendJson(httpRes, { error: "Lab file missing on disk" }, 404); return; }
    httpRes.status(200);
    httpRes.setHeader("Content-Type", contentTypeFor(file.fileName));
    httpRes.setHeader("Content-Disposition", `attachment; filename="${file.fileName.replace(/"/g, "")}"`);
    httpRes.send(Buffer.from(file.body));
    return;
  
        });
  }
}
