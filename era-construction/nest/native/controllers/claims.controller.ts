import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { findProjectById } from "@/lib/projects.service";
import {
  createSubcontractorClaim,
  listSubcontractorClaims,
  softDeleteSubcontractorClaim,
  transitionSubcontractorClaim,
} from "@/lib/subcontractor-claims.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const createSchema = z.object({
  subcontractorName: z.string().min(1),
  amountNet: z.number().positive(),
  voen: z.string().optional(),
  notes: z.string().optional(),
});

@Controller("api/projects/:id/subcontractor-claims")
@UseGuards(ConstructionStaffGuard)
export class ClaimsController {
  @Get()
  list(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, () => listSubcontractorClaims(id));
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
      const project = await findProjectById(id);
      if (!project) throw new NotFoundException({ error: "Project not found" });
      const parsed = createSchema.parse(body ?? {});
      const result = await createSubcontractorClaim(id, {
        subcontractorName: parsed.subcontractorName,
        amountNet: parsed.amountNet,
        notes: parsed.voen
          ? `voen:${parsed.voen}${parsed.notes ? `; ${parsed.notes}` : ""}`
          : parsed.notes,
      });
      return assertOk(result).row;
    });
  }

  @Patch()
  transition(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({
          claimId: z.string().min(1),
          status: z.enum(["SUBMITTED", "APPROVED_OPS", "REJECTED", "CANCELLED"]),
        })
        .parse(body ?? {});
      const result = await transitionSubcontractorClaim(id, parsed.claimId, parsed.status);
      return assertOk(result).row;
    });
  }

  @Delete()
  remove(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Query("claimId") claimId?: string,
  ) {
    return withStaffTenant(req, session, async () => {
      if (!claimId) throw new BadRequestException({ error: "claimId required" });
      const result = await softDeleteSubcontractorClaim(id, claimId);
      return assertOk(result).row;
    });
  }
}
