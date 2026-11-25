import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  findPractitionerIdForUser,
  signClinicalNote,
} from "@/domain/notes/clinical-note.service";
import { NOTE_REQUIRED_FIELDS } from "@/domain/notes/note-required";

@Controller()
export class NotesIdSignController {
  @UseGuards(ClinicApiGuard)
  @Post("api/notes/:id/sign")
  @HttpCode(200)
  async postSign(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
      if (denied) return clinicBody(denied);
      const authorPractitionerId = await findPractitionerIdForUser(session.sub);
      try {
        return await signClinicalNote({
          noteId: httpReq.params.id,
          userId: session.sub,
          authorPractitionerId,
          request: httpReq,
        });
      } catch (err) {
        const e = err as Error & { status?: number; code?: string; missing?: unknown };
        if (e.status) {
          throw new HttpException(
            {
              error: e.message,
              code: e.code ?? NOTE_REQUIRED_FIELDS,
              missing: e.missing,
            },
            e.status,
          );
        }
        throw err;
      }
    });
  }
}