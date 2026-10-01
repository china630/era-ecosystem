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
import { Decimal, PayrollComponentKind, PayrollRunStatus } from "@erafinance/database";
import { Public } from "../auth/decorators/public.decorator";
import { InternalServiceTokenGuard } from "../common/guards/internal-service-token.guard";
import { PrismaService } from "../prisma/prisma.service";
import { runWithTenantContextAsync } from "../prisma/tenant-context";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { PayrollComponentCode } from "./payroll-component-codes";
import { PayrollComponentsService } from "./payroll-components.service";

@ApiTags("internal")
@Controller("internal/v1/workforce/payroll")
@Public()
@UseGuards(InternalServiceTokenGuard)
export class InternalWorkforcePayrollController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly components: PayrollComponentsService,
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
      () => this.applyAdvanceLine(organizationId, financeEmployeeId, body),
    );
  }

  private async applyAdvanceLine(
    organizationId: string,
    financeEmployeeId: string,
    body: { amountAzn: number; note?: string; year: number; month: number },
  ) {
    const emp = await this.prisma.employee.findFirst({
      where: { id: financeEmployeeId, organizationId, deletedAt: null },
    });
    if (!emp) throw new NotFoundException("Employee not found");

    let run = await this.prisma.payrollRun.findFirst({
      where: {
        organizationId,
        year: body.year,
        month: body.month,
        status: PayrollRunStatus.DRAFT,
      },
    });
    const slip = run
      ? await this.prisma.payrollSlip.findFirst({
          where: { payrollRunId: run.id, employeeId: financeEmployeeId },
        })
      : null;

    if (!run || !slip) {
      await this.prisma.payrollAdvanceHold.create({
        data: {
          organizationId,
          employeeId: financeEmployeeId,
          year: body.year,
          month: body.month,
          amount: new Decimal(body.amountAzn),
          note: (body.note ?? "").trim(),
        },
      });
      return { queued: true, held: true, payrollRunId: run?.id ?? null };
    }

    const nextNet = new Decimal(slip.net).sub(body.amountAzn);
    if (nextNet.isNegative()) {
      await this.prisma.payrollAdvanceHold.create({
        data: {
          organizationId,
          employeeId: financeEmployeeId,
          year: body.year,
          month: body.month,
          amount: new Decimal(body.amountAzn),
          note: (body.note ?? "").trim(),
        },
      });
      return { queued: true, held: true, reason: "net_would_go_negative" };
    }

    const componentIdByCode = await this.components.componentIdMap(organizationId);
    await this.prisma.$transaction([
      this.prisma.payrollSlipLine.create({
        data: {
          organizationId,
          payrollSlipId: slip.id,
          componentId: componentIdByCode.get(PayrollComponentCode.ADVANCE) ?? null,
          code: PayrollComponentCode.ADVANCE,
          kind: PayrollComponentKind.DEDUCTION,
          amount: new Decimal(body.amountAzn),
          note: (body.note ?? "").trim(),
        },
      }),
      this.prisma.payrollSlip.update({
        where: { id: slip.id },
        data: { net: nextNet },
      }),
    ]);
    return {
      queued: true,
      held: false,
      payrollRunId: run.id,
      status: run.status,
    };
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
      () => this.postedPayslip(orgId, empId, year, month),
    );
  }

  private async postedPayslip(
    orgId: string,
    empId: string,
    year: number,
    month: number,
  ) {
    const run = await this.prisma.payrollRun.findFirst({
      where: {
        organizationId: orgId,
        year,
        month,
        status: PayrollRunStatus.POSTED,
      },
    });
    if (!run) throw new NotFoundException("Posted payroll not found");

    const slip = await this.prisma.payrollSlip.findFirst({
      where: {
        organizationId: orgId,
        payrollRunId: run.id,
        employeeId: empId,
      },
      include: { lines: true },
    });
    if (!slip) throw new NotFoundException("Payslip not found");

    return {
      year,
      month,
      gross: String(slip.gross),
      net: String(slip.net),
      lines: slip.lines.map((l) => ({
        code: l.code,
        kind: l.kind,
        amount: String(l.amount),
      })),
    };
  }
}
