import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import {
  CreateCommercialOutletDto,
  SuspendSatelliteDto,
  UpdateCommercialOutletDto,
} from "./dto/structure-outlet.dto";
import { StructureService } from "./structure.service";

@UseGuards(JwtAuthGuard)
@Controller("v1/structure")
export class StructureController {
  constructor(private readonly structure: StructureService) {}

  private requireOrgId(user: EraJwtPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return user.organizationId;
  }

  @Get("tree")
  tree(@CurrentUser() user: EraJwtPayload) {
    const orgId = this.requireOrgId(user);
    return this.structure.getTreeForOrganization(orgId);
  }

  @Post("satellites/:satelliteKey/suspend")
  suspendSatellite(
    @CurrentUser() user: EraJwtPayload,
    @Param("satelliteKey") satelliteKey: string,
    @Body() body: SuspendSatelliteDto,
  ) {
    const orgId = this.requireOrgId(user);
    return this.structure.setSatelliteSuspended(
      user.sub,
      orgId,
      satelliteKey,
      body.suspend === true,
    );
  }

  @Get("outlets")
  listOutlets(
    @CurrentUser() user: EraJwtPayload,
    @Query("satelliteKey") satelliteKey?: string,
  ) {
    const orgId = this.requireOrgId(user);
    return this.structure.listOutlets(orgId, satelliteKey?.trim() || undefined);
  }

  @Post("outlets")
  createOutlet(
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateCommercialOutletDto,
  ) {
    const orgId = this.requireOrgId(user);
    return this.structure.createOutlet(user.sub, orgId, dto);
  }

  @Patch("outlets/:id")
  updateOutlet(
    @CurrentUser() user: EraJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommercialOutletDto,
  ) {
    const orgId = this.requireOrgId(user);
    return this.structure.updateOutlet(user.sub, orgId, id, dto);
  }

  @Delete("outlets/:id")
  deleteOutlet(
    @CurrentUser() user: EraJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const orgId = this.requireOrgId(user);
    return this.structure.deleteOutlet(user.sub, orgId, id);
  }
}
