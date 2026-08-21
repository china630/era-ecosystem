import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { CreatePlacementJobDto } from "./dto/create-placement-job.dto";
import { AdvancePlacementJobDto } from "./dto/advance-placement-job.dto";
import { PlacementJobService } from "./placement-job.service";
import type { TopologyCode } from "./placement-hops";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions("admin.system")
@Controller()
export class PlacementJobController {
  constructor(private readonly jobs: PlacementJobService) {}

  @Post("v1/admin/orgs/:orgId/placement-jobs")
  create(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body() body: CreatePlacementJobDto,
  ) {
    return this.jobs.createJob({
      organizationId: orgId,
      satelliteKey: body.satelliteKey,
      fromTopology: body.fromTopology as TopologyCode,
      toTopology: body.toTopology as TopologyCode,
      targetBaseUrl: body.targetBaseUrl,
    });
  }

  @Get("v1/admin/orgs/:orgId/placement-jobs")
  list(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.jobs.listForOrg(orgId);
  }

  @Post("v1/admin/placement-jobs/:id/advance")
  advance(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AdvancePlacementJobDto,
  ) {
    return this.jobs.advance(id, body.action, {
      targetBaseUrl: body.targetBaseUrl,
      errorMessage: body.errorMessage,
    });
  }
}
