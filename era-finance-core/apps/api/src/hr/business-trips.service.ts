import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BusinessTripKind, Decimal } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { CashOrderService } from "../kassa/cash-order.service";
import { inclusiveCalendarDays } from "./vacation-balance.util";

@Injectable()
export class BusinessTripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashOrders: CashOrderService,
  ) {}

  list(organizationId: string, employeeId?: string) {
    return this.prisma.businessTrip.findMany({
      where: {
        organizationId,
        ...(employeeId ? { employeeId } : {}),
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.businessTrip.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Business trip not found");
    return row;
  }

  async create(
    organizationId: string,
    dto: {
      employeeId: string;
      kind: BusinessTripKind;
      regionCode: string;
      startDate: string;
      endDate: string;
      purpose?: string;
    },
  ) {
    const emp = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId },
    });
    if (!emp) throw new BadRequestException("Employee not found");
    const start = new Date(dto.startDate.slice(0, 10) + "T12:00:00.000Z");
    const end = new Date(dto.endDate.slice(0, 10) + "T12:00:00.000Z");
    if (end < start) {
      throw new BadRequestException("endDate must be on or after startDate");
    }
    return this.prisma.businessTrip.create({
      data: {
        organizationId,
        employeeId: dto.employeeId,
        kind: dto.kind,
        regionCode: dto.regionCode.trim(),
        startDate: start,
        endDate: end,
        purpose: dto.purpose?.trim() ?? "",
        status: "DRAFT",
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: {
      kind?: BusinessTripKind;
      regionCode?: string;
      startDate?: string;
      endDate?: string;
      purpose?: string;
    },
  ) {
    const trip = await this.getOne(organizationId, id);
    if (trip.status === "LINKED") {
      throw new BadRequestException("Cannot update trip linked to advance report");
    }
    const start = dto.startDate
      ? new Date(dto.startDate.slice(0, 10) + "T12:00:00.000Z")
      : trip.startDate;
    const end = dto.endDate
      ? new Date(dto.endDate.slice(0, 10) + "T12:00:00.000Z")
      : trip.endDate;
    if (end < start) {
      throw new BadRequestException("endDate must be on or after startDate");
    }
    return this.prisma.businessTrip.update({
      where: { id },
      data: {
        ...(dto.kind != null ? { kind: dto.kind } : {}),
        ...(dto.regionCode != null
          ? { regionCode: dto.regionCode.trim() }
          : {}),
        ...(dto.startDate != null ? { startDate: start } : {}),
        ...(dto.endDate != null ? { endDate: end } : {}),
        ...(dto.purpose != null ? { purpose: dto.purpose.trim() } : {}),
        status: "DRAFT",
        perDiemTotal: null,
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const trip = await this.getOne(organizationId, id);
    if (trip.status === "LINKED") {
      throw new BadRequestException("Cannot delete trip linked to advance report");
    }
    await this.prisma.businessTrip.delete({ where: { id } });
    return { ok: true };
  }

  async calculatePerDiem(organizationId: string, tripId: string) {
    const trip = await this.getOne(organizationId, tripId);
    const norm = await this.prisma.perDiemNorm.findFirst({
      where: { organizationId, regionCode: trip.regionCode },
    });
    if (!norm) {
      throw new BadRequestException(
        `Per diem norm not found for region ${trip.regionCode}`,
      );
    }
    const days = inclusiveCalendarDays(trip.startDate, trip.endDate);
    let daily = new Decimal(norm.dailyAznDomestic);
    if (trip.kind === BusinessTripKind.FOREIGN) {
      daily = daily.mul(norm.foreignFactor);
    }
    const perDiemTotal = daily.mul(days).toDecimalPlaces(2);
    return this.prisma.businessTrip.update({
      where: { id: tripId },
      data: {
        perDiemTotal,
        status: "CALCULATED",
      },
    });
  }

  async createAdvanceFromTrip(organizationId: string, tripId: string) {
    let trip = await this.getOne(organizationId, tripId);
    if (trip.advanceReportId) {
      throw new BadRequestException("Advance report already linked");
    }
    if (trip.perDiemTotal == null) {
      trip = await this.calculatePerDiem(organizationId, tripId);
    }
    const amount = Number(trip.perDiemTotal);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Per diem total must be positive");
    }
    const regionName =
      (
        await this.prisma.perDiemNorm.findFirst({
          where: { organizationId, regionCode: trip.regionCode },
          select: { regionName: true },
        })
      )?.regionName ?? trip.regionCode;

    const report = await this.cashOrders.createAdvanceReportDraft(
      organizationId,
      {
        employeeId: trip.employeeId,
        reportDate: trip.endDate.toISOString().slice(0, 10),
        purpose: trip.purpose || `Business trip ${trip.regionCode}`,
        expenseLines: [
          {
            amount,
            description: `Per diem ${regionName}`,
          },
        ],
      },
    );
    return this.prisma.businessTrip.update({
      where: { id: tripId },
      data: {
        advanceReportId: report.id,
        status: "LINKED",
      },
    });
  }
}
