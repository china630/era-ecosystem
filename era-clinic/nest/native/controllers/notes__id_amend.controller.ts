import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  amendClinicalNote,
  findPractitionerIdForUser,
} from "@/domain/notes/clinical-note.service";

const amendSchema = z.object({
  fieldValues: z.record(z.string()).optional(),
});

@Controller()
export class NotesIdAmendController {
  @UseGuards(ClinicApiGuard)
  @Post("api/notes/:id/amend")
  @HttpCode(200)
  async postAmend(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
      if (denied) return clinicBody(denied);
      const authorPractitionerId = await findPractitionerIdForUser(session.sub);
      if (!authorPractitionerId) {
        throw new HttpException({ error: "No practitioner linked to session" }, 403);
      }
      const body = amendSchema.parse(httpReq.body ?? {});
      try {
        return await amendClinicalNote({
          noteId: httpReq.params.id,
          userId: session.sub,
          authorPractitionerId,
          fieldValues: body.fieldValues,
          request: httpReq,
        });
      } catch (err) {
        const e = err as Error & { status?: number; code?: string };
        if (e.status) {
          throw new HttpException({ error: e.message, code: e.code }, e.status);
        }
        throw err;
      }
    });
  }
}