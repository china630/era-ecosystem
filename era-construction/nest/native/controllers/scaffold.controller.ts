import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import * as depth from "@/lib/project-depth.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

@Controller("api/projects/:id")
@UseGuards(ConstructionStaffGuard)
export class ScaffoldController {
  @Get("parties")
  listParties(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Query("role") role?: string,
  ) {
    return withStaffTenant(req, session, () => depth.listParties(id, role));
  }

  @Post("parties")
  @HttpCode(201)
  createParty(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({
          role: z.enum(["GC", "SUB", "OWNER", "INSPECTOR"]),
          displayName: z.string().min(1).max(200),
          financeCounterpartyId: z.string().optional().nullable(),
        })
        .parse(body ?? {});
      return assertOk(await depth.createParty(id, parsed)).row;
    });
  }

  @Delete("parties")
  deleteParty(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Query("partyId") partyId?: string,
  ) {
    return withStaffTenant(req, session, async () => {
      if (!partyId) throw new BadRequestException({ error: "partyId required" });
      return assertOk(await depth.softDeleteParty(id, partyId)).row;
    });
  }

  @Get("phases")
  listPhases(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, () => depth.listPhases(id));
  }

  @Post("phases")
  @HttpCode(201)
  createPhase(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({
          code: z.string().min(1).max(64),
          name: z.string().min(1).max(200),
          sortOrder: z.number().int().optional(),
        })
        .parse(body ?? {});
      return assertOk(await depth.createPhase(id, parsed)).row;
    });
  }

  @Delete("phases")
  deletePhase(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Query("phaseId") phaseId?: string,
  ) {
    return withStaffTenant(req, session, async () => {
      if (!phaseId) throw new BadRequestException({ error: "phaseId required" });
      return assertOk(await depth.softDeletePhase(id, phaseId)).row;
    });
  }

  @Get("locations")
  listLocations(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, () => depth.listLocations(id));
  }

  @Post("locations")
  @HttpCode(201)
  createLocation(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({ code: z.string().min(1).max(64), name: z.string().min(1).max(200) })
        .parse(body ?? {});
      return assertOk(await depth.createLocation(id, parsed)).row;
    });
  }

  @Delete("locations")
  deleteLocation(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Query("locationId") locationId?: string,
  ) {
    return withStaffTenant(req, session, async () => {
      if (!locationId) throw new BadRequestException({ error: "locationId required" });
      return assertOk(await depth.softDeleteLocation(id, locationId)).row;
    });
  }

  @Get("rfis")
  listRfis(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, () => depth.listRfis(id));
  }

  @Post("rfis")
  @HttpCode(201)
  createRfi(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({
          subject: z.string().min(1).max(200),
          question: z.string().min(1).max(4000),
          assignee: z.string().max(200).optional(),
          dueDate: z.string().optional().nullable(),
          impactSchedule: z.boolean().optional(),
          impactCost: z.boolean().optional(),
          ifcElementId: z.string().max(200).optional().nullable(),
          externalViewerUrl: z.string().max(2048).optional().nullable(),
        })
        .parse(body ?? {});
      return assertOk(await depth.createRfi(id, parsed)).row;
    });
  }

  @Patch("rfis")
  answerRfi(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({
          rfiId: z.string().min(1),
          answer: z.string().min(1).max(8000),
          impactSchedule: z.boolean().optional(),
          impactCost: z.boolean().optional(),
        })
        .parse(body ?? {});
      return assertOk(await depth.answerRfi(id, parsed.rfiId, parsed)).row;
    });
  }

  @Get("submittals")
  listSubmittals(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, () => depth.listSubmittals(id));
  }

  @Post("submittals")
  @HttpCode(201)
  createSubmittal(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({ title: z.string().min(1).max(200), specSection: z.string().max(64).optional() })
        .parse(body ?? {});
      return assertOk(await depth.createSubmittal(id, parsed)).row;
    });
  }

  @Patch("submittals")
  transitionSubmittal(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({
          submittalId: z.string().min(1),
          status: z.enum(["IN_REVIEW", "APPROVED", "REJECTED", "REVISE"]),
        })
        .parse(body ?? {});
      return assertOk(await depth.transitionSubmittal(id, parsed.submittalId, parsed.status)).row;
    });
  }

  @Get("inspections")
  listInspections(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, () => depth.listInspections(id));
  }

  @Post("inspections")
  @HttpCode(201)
  createInspection(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({ title: z.string().min(1).max(200), formJson: z.string().max(20000).optional() })
        .parse(body ?? {});
      return assertOk(await depth.createInspection(id, parsed)).row;
    });
  }

  @Patch("inspections")
  failInspection(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({ inspectionId: z.string().min(1), action: z.literal("FAIL") })
        .parse(body ?? {});
      return assertOk(await depth.failInspection(id, parsed.inspectionId));
    });
  }

  @Get("change-requests")
  listChangeRequests(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, () => depth.listChangeRequests(id));
  }

  @Post("change-requests")
  @HttpCode(201)
  createChangeRequest(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({
          title: z.string().min(1).max(200),
          description: z.string().max(4000).optional(),
          rfiId: z.string().optional().nullable(),
          financeContractId: z.string().optional().nullable(),
          impactSchedule: z.boolean().optional(),
          impactCost: z.boolean().optional(),
        })
        .parse(body ?? {});
      return assertOk(await depth.createChangeRequest(id, parsed)).row;
    });
  }

  @Patch("change-requests")
  transitionChangeRequest(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({
          changeRequestId: z.string().min(1),
          status: z.enum(["SUBMITTED", "APPROVED_OPS"]),
        })
        .parse(body ?? {});
      return assertOk(
        await depth.transitionChangeRequest(id, parsed.changeRequestId, parsed.status),
      ).row;
    });
  }
}
