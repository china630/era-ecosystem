import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import {
  createPunchListItem,
  listPunchListItems,
  updatePunchListItemStatus,
} from "@/lib/punch-list.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const createSchema = z.object({
  location: z.string().min(1),
  description: z.string().min(1),
  photoUrl: z.string().max(2048).optional(),
  assignee: z.string().max(200).optional(),
  dueDate: z.string().optional().nullable(),
  drawingRevisionId: z.string().optional().nullable(),
  pinX: z.number().finite().optional().nullable(),
  pinY: z.number().finite().optional().nullable(),
  ifcElementId: z.string().max(200).optional().nullable(),
  externalViewerUrl: z.string().max(2048).optional().nullable(),
});

const patchSchema = z.object({
  itemId: z.string(),
  status: z.enum(["OPEN", "FIXED", "VERIFIED"]),
});

@Controller("api/projects/:id/punch-list")
@UseGuards(ConstructionStaffGuard)
export class PunchListController {
  @Get()
  list(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, () => listPunchListItems(id));
  }

  @Post()
  @HttpCode(201)
  create(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = createSchema.parse(body ?? {});
      const result = await createPunchListItem(id, parsed);
      return assertOk(result).row;
    });
  }

  @Patch()
  updateStatus(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = patchSchema.parse(body ?? {});
      const result = await updatePunchListItemStatus(id, parsed.itemId, parsed.status);
      return assertOk(result).row;
    });
  }
}
