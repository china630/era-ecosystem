import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  NotFoundException,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import { createShipment } from "@/integration/control-plane-platform.client";
import { materialRequisitionDenied } from "@/lib/material-gates";
import { findProjectByCode } from "@/lib/projects.service";
import {
  createMaterialRequisition,
  listMaterialRequisitions,
  transitionMaterialRequisition,
} from "@/lib/material-requisitions.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const createSchema = z.object({
  projectCode: z.string(),
  itemCode: z.string(),
  description: z.string(),
  qty: z.number().positive(),
});

@Controller("api/material-requisitions")
@UseGuards(ConstructionStaffGuard)
export class MaterialsController {
  @Get()
  list(@Req() req: ConstructionRequest, @Staff() session: StaffSession) {
    return withStaffTenant(req, session, () => listMaterialRequisitions());
  }

  @Post()
  @HttpCode(201)
  create(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = createSchema.parse(body);
      const project = await findProjectByCode(parsed.projectCode);
      const denied = materialRequisitionDenied(project);
      if (denied) throw new HttpException({ error: denied }, 404);
      if (!project) throw new NotFoundException({ error: "Project not found" });

      const requisition = await createMaterialRequisition({
        projectId: project.id,
        itemCode: parsed.itemCode,
        description: parsed.description,
        qty: parsed.qty,
      });

      const organizationId = requestOrganizationId();
      if (organizationId) {
        try {
          await createShipment(
            {
              sourceEntityType: "material_requisition",
              sourceEntityId: requisition.id,
              externalRef: parsed.itemCode,
            },
            { organizationId },
          );
        } catch {
          /* optional */
        }
      }

      return requisition;
    });
  }

  @Patch()
  transition(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = z
        .object({
          requisitionId: z.string().min(1),
          status: z.enum(["SUBMITTED", "FULFILLED", "CANCELLED"]),
        })
        .parse(body ?? {});
      const result = await transitionMaterialRequisition(parsed.requisitionId, parsed.status);
      return assertOk(result).row;
    });
  }
}
