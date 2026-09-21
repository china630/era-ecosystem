import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { CreatePayrollComponentDto } from "./dto/create-payroll-component.dto";
import { PayrollComponentsService } from "./payroll-components.service";

@ApiTags("hr-payroll-components")
@ApiBearerAuth("bearer")
@Controller("hr/payroll-components")
export class PayrollComponentsController {
  constructor(private readonly components: PayrollComponentsService) {}

  @Get()
  @ApiOperation({ summary: "List payroll components (ensures seed defaults)" })
  list(@OrganizationId() organizationId: string) {
    return this.components.ensureDefaultComponents(organizationId).then(() =>
      this.components.list(organizationId),
    );
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions(CP_PERMISSION.API_PAYROLL_MONEY)
  @ApiOperation({ summary: "Create custom payroll component (arbitrary code)" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreatePayrollComponentDto,
  ) {
    return this.components.create(organizationId, dto);
  }
}
