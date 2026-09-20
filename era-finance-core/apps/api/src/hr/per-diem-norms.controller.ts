import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { PerDiemNormsService } from "./per-diem-norms.service";
import {
  CreatePerDiemNormDto,
  UpdatePerDiemNormDto,
} from "./dto/business-trip.dto";

@ApiTags("hr-per-diem-norms")
@ApiBearerAuth("bearer")
@Controller("hr/per-diem-norms")
@UseGuards(PermissionsGuard)
export class PerDiemNormsController {
  constructor(private readonly norms: PerDiemNormsService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  @ApiOperation({ summary: "List per diem norms" })
  list(@OrganizationId() organizationId: string) {
    return this.norms.list(organizationId);
  }

  @Post()
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreatePerDiemNormDto,
  ) {
    return this.norms.create(organizationId, dto);
  }

  @Patch(":id")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdatePerDiemNormDto,
  ) {
    return this.norms.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Permissions(CP_PERMISSION.API_PAYROLL_HR_CARD)
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.norms.remove(organizationId, id);
  }
}
