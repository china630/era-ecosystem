import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { createDrawingRevision, listDrawingRevisions } from "@/lib/cde-documents.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const bodySchema = z.object({
  projectId: z.string().min(1),
  drawingCode: z.string().min(1).max(64),
  revision: z.string().min(1).max(64),
  sheetNumber: z.string().max(64).optional(),
  fileName: z.string().max(500).optional(),
  publish: z.boolean().optional(),
});

@Controller("api/cde/documents")
@UseGuards(ConstructionStaffGuard)
export class CdeController {
  @Get()
  list(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Query("projectId") projectId?: string,
  ) {
    return withStaffTenant(req, session, async () => {
      const rows = await listDrawingRevisions(projectId ?? null);
      return { documents: rows };
    });
  }

  @Post()
  @HttpCode(201)
  create(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = bodySchema.parse(body ?? {});
      const result = await createDrawingRevision(parsed);
      return assertOk(result).row;
    });
  }
}
