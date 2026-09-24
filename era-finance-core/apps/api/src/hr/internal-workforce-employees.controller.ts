import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { InternalServiceTokenGuard } from "../common/guards/internal-service-token.guard";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { WorkforceOpeningDto } from "./dto/workforce-opening.dto";
import { EmployeesService } from "./employees.service";

@ApiTags("internal")
@Controller("internal/v1/workforce/employees")
@Public()
@UseGuards(InternalServiceTokenGuard)
export class InternalWorkforceEmployeesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly employees: EmployeesService,
  ) {}

  @Post("opening")
  @ApiOperation({
    summary:
      "S2S: stamp contract salary / internalRate / inverted vacation opening (hr_full)",
  })
  async opening(@Body() dto: WorkforceOpeningDto) {
    const organizationId = dto.organizationId.trim();
    const cpEmploymentId = dto.cpEmploymentId.trim();
    const hasHr = await this.subscriptionAccess.hasModule(
      organizationId,
      "hr_full",
    );
    if (!hasHr) {
      throw new ForbiddenException("hr_full required");
    }
    return this.employees.applyWorkforceOpening(organizationId, cpEmploymentId, {
      salary: dto.salary,
      internalRate: dto.internalRate,
      balanceDays: dto.balanceDays,
      baseVacationDaysPerYear: dto.baseVacationDaysPerYear,
      asOfDate: dto.asOfDate,
    });
  }

  @Get("by-cp-employment")
  @ApiOperation({
    summary:
      "S2S: contract salary + vacationDaysBalance by CP employment (hr_full required)",
  })
  async byCpEmployment(
    @Query("organizationId") organizationId: string,
    @Query("cpEmploymentId") cpEmploymentId: string,
  ) {
    if (!organizationId?.trim() || !cpEmploymentId?.trim()) {
      return {
        salary: null,
        vacationDaysBalance: null,
        employmentStatus: null,
        hrFull: false,
      };
    }
    const hasHr = await this.subscriptionAccess.hasModule(
      organizationId.trim(),
      "hr_full",
    );
    if (!hasHr) {
      return {
        salary: null,
        vacationDaysBalance: null,
        employmentStatus: null,
        hrFull: false,
      };
    }
    const row = await this.prisma.employee.findFirst({
      where: {
        organizationId: organizationId.trim(),
        cpEmploymentId: cpEmploymentId.trim(),
      },
      select: {
        salary: true,
        vacationDaysBalance: true,
        employmentStatus: true,
      },
    });
    if (!row) {
      return {
        salary: null,
        vacationDaysBalance: null,
        employmentStatus: null,
        hrFull: true,
        found: false,
      };
    }
    return {
      salary: row.salary != null ? Number(row.salary) : null,
      vacationDaysBalance:
        row.vacationDaysBalance != null
          ? Number(row.vacationDaysBalance)
          : null,
      employmentStatus: row.employmentStatus,
      hrFull: true,
      found: true,
    };
  }
}
