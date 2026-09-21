import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { AbsenceTypesService } from "./absence-types.service";

@ApiTags("hr-absence-types")
@ApiBearerAuth("bearer")
@Controller("hr/absence-types")
export class AbsenceTypesController {
  constructor(private readonly types: AbsenceTypesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_REPORTS_NAS)
  @ApiOperation({
    summary:
      "Məzuniyyət növləri (AZ); boşdursa — TK AР üzrə standart dəst avtomatik yaradılır",
  })
  list(@OrganizationId() organizationId: string) {
    return this.types.listOrSeed(organizationId);
  }
}
