import { Controller, HttpCode, Patch, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { NOTE_NOT_DRAFT } from "@/domain/notes/clinical-note.service";
import { updateClinicalNoteDraft } from "@/domain/notes/clinical-note.service";

const patchSchema = z.object({
  fieldValues: z.record(z.string()),
});

@Controller()
export class NotesIdController {
  @UseGuards(ClinicApiGuard)
  @Patch("api/notes/:id")
  @HttpCode(200)
  async patchNote(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
      if (denied) return clinicBody(denied);
      const body = patchSchema.parse(httpReq.body);
      try {
        return await updateClinicalNoteDraft(httpReq.params.id, body.fieldValues, session.sub, httpReq);
      } catch (err) {
        const e = err as Error & { status?: number; code?: string };
        if (e.status) {
          throw new HttpException({ error: e.message, code: e.code ?? NOTE_NOT_DRAFT }, e.status);
        }
        throw err;
      }
    });
  }
}