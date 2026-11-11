import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { InternalServiceTokenGuard } from "../common/guards/internal-service-token.guard";
import { runWithTenantContextAsync } from "../prisma/tenant-context";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { PayrollService } from "./payroll.service";

@ApiTags("internal")
@Controller("internal/v1/workforce/payroll")
@Public()
@UseGuards(InternalServiceTokenGuard)
export class InternalWorkforcePayrollController {
  constructor(
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly payroll: PayrollService,
  ) {}

  @Post("advance-line")
  @ApiOperation({
    summary:
      "S2S: attach ADVANCE deduction to DRAFT payroll run (never POSTED/PAID)",
  })
  async advanceLine(
    @Body()
    body: {
      organizationId: string;
      financeEmployeeId: string;
      amountAzn: number;
      note?: string;
      year: number;
      month: number;
    },
  ) {
    const organizationId = body.organizationId?.trim();
    const financeEmployeeId = body.financeEmployeeId?.trim();
    if (!organizationId || !financeEmployeeId) {
      throw new NotFoundException("organizationId and financeEmployeeId required");
    }
    const hasHr = await this.subscriptionAccess.hasModule(
      organizationId,
      "hr_full",
    );
    if (!hasHr) {
      throw new ForbiddenException("hr_full required");
    }
    if (!(body.amountAzn > 0)) {
      throw new ForbiddenException("amountAzn must be positive");
    }

    return runWithTenantContextAsync(
      { organizationId, skipTenantFilter: false },
      () =>
        this.payroll.applyWorkforceAdvanceLine(
          organizationId,
          financeEmployeeId,
          body,
        ),
    );
  }

  @Get("payslip")
  @ApiOperation({
    summary: "S2S: posted payslip for employee cabinet (no internalRate)",
  })
  async payslip(
    @Query("organizationId") organizationId: string,
    @Query("financeEmployeeId") financeEmployeeId: string,
    @Query("year") yearRaw: string,
    @Query("month") monthRaw: string,
  ) {
    const orgId = organizationId?.trim();
    const empId = financeEmployeeId?.trim();
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!orgId || !empId || !Number.isFinite(year) || !Number.isFinite(month)) {
      throw new NotFoundException("payslip query incomplete");
    }
    const hasHr = await this.subscriptionAccess.hasModule(orgId, "hr_full");
    if (!hasHr) {
      throw new ForbiddenException("hr_full required");
    }

    return runWithTenantContextAsync(
      { organizationId: orgId, skipTenantFilter: false },
      () => this.payroll.getPostedWorkforcePayslip(orgId, empId, year, month),
    );
  }
}
