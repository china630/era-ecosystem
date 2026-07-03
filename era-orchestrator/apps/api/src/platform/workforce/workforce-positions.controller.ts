import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@era365/database";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { EraJwtPayload } from "../../auth/jwt-payload.type";
import {
  CreateWorkforcePositionDto,
  UpdateWorkforcePositionDto,
} from "./dto/workforce-org.dto";
import { WorkforcePositionsService } from "./workforce-positions.service";

@ApiTags("platform-workforce-positions")
@ApiBearerAuth("bearer")
@Controller("platform/v1/workforce/positions")
@UseGuards(RolesGuard)
export class WorkforcePositionsController {
  constructor(private readonly positions: WorkforcePositionsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER, UserRole.DEPARTMENT_HEAD)
  @ApiOperation({ summary: "List workforce positions" })
  list(
    @OrganizationId() organizationId: string,
    @Query("orgUnitId") orgUnitId?: string,
  ) {
    return this.positions.list(organizationId, orgUnitId?.trim());
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateWorkforcePositionDto,
  ) {
    return this.positions.create(organizationId, user.sub, dto);
  }

  @Patch(":id")
  @Roles(UserRole.OWNER, UserRole.HR_MANAGER)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: UpdateWorkforcePositionDto,
  ) {
    return this.positions.update(organizationId, id, user.sub, dto);
  }
}
