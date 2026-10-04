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
import { runWithTenantContextAsync } from "../prisma/tenant-context";
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
    return runWithTenantContextAsync(
      { organizationId, skipTenantFilter: false },
      () =>
        this.employees.applyWorkforceOpening(organizationId, cpEmploymentId, {
          salary: dto.salary,
          internalRate: dto.internalRate,
          balanceDays: dto.balanceDays,
          baseVacationDaysPerYear: dto.baseVacationDaysPerYear,
          asOfDate: dto.asOfDate,
        }),
    );
  }

  @Get("picker")
  @ApiOperation({
    summary: "S2S: active employees for a satellite staff picker (display name via MDM, no rates)",
  })
  async picker(@Query("organizationId") organizationId: string) {
    const org = organizationId?.trim();
    if (!org) return { items: [] as Array<{ id: string; globalPersonId: string; name: string }> };
    return runWithTenantContextAsync(
      { organizationId: org, skipTenantFilter: false },
      async () => {
        const page = await this.employees.list(org, { page: 1, pageSize: 500 });
        const persons = page.persons as Record<string, { displayName?: string | null }>;
        const items = page.items
          .filter(
            (item) =>
              String((item as { employmentStatus?: string }).employmentStatus ?? "ACTIVE") ===
              "ACTIVE",
          )
          .map((item) => {
            const globalPersonId = item.globalPersonId;
            const name = persons[globalPersonId]?.displayName?.trim() || "";
            return { id: item.id, globalPersonId, name };
          })
          .filter((row) => row.name.length > 0);
        return { items };
      },
    );
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
    const orgId = organizationId.trim();
    const row = await runWithTenantContextAsync(
      { organizationId: orgId, skipTenantFilter: false },
      () =>
        this.prisma.employee.findFirst({
          where: {
            organizationId: orgId,
            cpEmploymentId: cpEmploymentId.trim(),
          },
          select: {
            salary: true,
            vacationDaysBalance: true,
            employmentStatus: true,
          },
        }),
    );
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
