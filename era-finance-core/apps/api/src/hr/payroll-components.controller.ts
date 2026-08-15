import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create custom payroll component (arbitrary code)" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreatePayrollComponentDto,
  ) {
    return this.components.create(organizationId, dto);
  }
}
