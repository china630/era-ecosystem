import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkScheduleKind, Decimal } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WorkSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.workSchedule.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.workSchedule.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Work schedule not found");
    return row;
  }

  create(
    organizationId: string,
    dto: {
      name: string;
      kind: WorkScheduleKind;
      dayHours?: number;
      nightPremiumRate?: number;
      eveningPremiumRate?: number;
      overtimePremiumRate?: number;
    },
  ) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("name is required");
    return this.prisma.workSchedule.create({
      data: {
        organizationId,
        name,
        kind: dto.kind,
        dayHours: new Decimal(dto.dayHours ?? 8),
        nightPremiumRate: new Decimal(dto.nightPremiumRate ?? 1.5),
        eveningPremiumRate: new Decimal(dto.eveningPremiumRate ?? 1.2),
        overtimePremiumRate: new Decimal(dto.overtimePremiumRate ?? 2),
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: {
      name?: string;
      kind?: WorkScheduleKind;
      dayHours?: number;
      nightPremiumRate?: number;
      eveningPremiumRate?: number;
      overtimePremiumRate?: number;
    },
  ) {
    await this.getOne(organizationId, id);
    return this.prisma.workSchedule.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.kind != null ? { kind: dto.kind } : {}),
        ...(dto.dayHours != null ? { dayHours: new Decimal(dto.dayHours) } : {}),
        ...(dto.nightPremiumRate != null
          ? { nightPremiumRate: new Decimal(dto.nightPremiumRate) }
          : {}),
        ...(dto.eveningPremiumRate != null
          ? { eveningPremiumRate: new Decimal(dto.eveningPremiumRate) }
          : {}),
        ...(dto.overtimePremiumRate != null
          ? { overtimePremiumRate: new Decimal(dto.overtimePremiumRate) }
          : {}),
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    await this.prisma.employee.updateMany({
      where: { organizationId, workScheduleId: id },
      data: { workScheduleId: null },
    });
    await this.prisma.workSchedule.delete({ where: { id } });
    return { ok: true };
  }
}
