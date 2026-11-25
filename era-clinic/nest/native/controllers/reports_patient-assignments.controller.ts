import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { loadPatientAssignmentLedger, type AssignmentKind } from "@/domain/reports/patient-assignment-ledger";

@Controller()
export class ReportsPatientAssignmentsController {

  @UseGuards(ClinicApiGuard)
  @Get("api/reports/patient-assignments")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_REPORTS_PROCEDURES,
    );
    if (denied) return clinicBody(denied);
    if (!session) throw new HttpException({ error: "Unauthorized" }, 401);

    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const episodeId = (url.searchParams.get("episodeId") ?? "").trim();
    if (!episodeId) throw new HttpException({ error: "episodeId required" }, 400);

    const roomNumber = url.searchParams.get("roomNumber")?.trim() || null;
    const kindRaw = url.searchParams.get("kind")?.trim() || "all";
    const kind =
      kindRaw === "procedure" || kindRaw === "lab" || kindRaw === "visit"
        ? (kindRaw as AssignmentKind)
        : "all";

    const data = await loadPatientAssignmentLedger({
      episodeId,
      roomNumber,
      kind,
    });
    if (!data) throw new HttpException({ error: "Episode not found" }, 404);
    return data;
  
        });
  }
}
