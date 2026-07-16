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
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { PerDiemNormsService } from "./per-diem-norms.service";
import {
  CreatePerDiemNormDto,
  UpdatePerDiemNormDto,
} from "./dto/business-trip.dto";

@ApiTags("hr-per-diem-norms")
@ApiBearerAuth("bearer")
@Controller("hr/per-diem-norms")
@UseGuards(RolesGuard)
export class PerDiemNormsController {
  constructor(private readonly norms: PerDiemNormsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  @ApiOperation({ summary: "List per diem norms" })
  list(@OrganizationId() organizationId: string) {
    return this.norms.list(organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreatePerDiemNormDto,
  ) {
    return this.norms.create(organizationId, dto);
  }

  @Patch(":id")
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdatePerDiemNormDto,
  ) {
    return this.norms.update(organizationId, id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.ADMIN)
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.norms.remove(organizationId, id);
  }
}
