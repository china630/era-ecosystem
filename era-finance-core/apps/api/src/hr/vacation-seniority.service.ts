import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class VacationSeniorityService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.vacationSeniorityRule.findMany({
      where: { organizationId },
      orderBy: { yearsFrom: "asc" },
    });
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.vacationSeniorityRule.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException("Vacation seniority rule not found");
    return row;
  }

  async create(
    organizationId: string,
    dto: { yearsFrom: number; extraDays: number },
  ) {
    if (dto.yearsFrom < 0 || dto.extraDays < 0) {
      throw new BadRequestException("yearsFrom and extraDays must be >= 0");
    }
    try {
      return await this.prisma.vacationSeniorityRule.create({
        data: {
          organizationId,
          yearsFrom: dto.yearsFrom,
          extraDays: dto.extraDays,
        },
      });
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "P2002"
      ) {
        throw new ConflictException("Rule for this yearsFrom already exists");
      }
      throw e;
    }
  }

  async update(
    organizationId: string,
    id: string,
    dto: { yearsFrom?: number; extraDays?: number },
  ) {
    await this.getOne(organizationId, id);
    if (dto.yearsFrom != null && dto.yearsFrom < 0) {
      throw new BadRequestException("yearsFrom must be >= 0");
    }
    if (dto.extraDays != null && dto.extraDays < 0) {
      throw new BadRequestException("extraDays must be >= 0");
    }
    try {
      return await this.prisma.vacationSeniorityRule.update({
        where: { id },
        data: {
          ...(dto.yearsFrom != null ? { yearsFrom: dto.yearsFrom } : {}),
          ...(dto.extraDays != null ? { extraDays: dto.extraDays } : {}),
        },
      });
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "P2002"
      ) {
        throw new ConflictException("Rule for this yearsFrom already exists");
      }
      throw e;
    }
  }

  async remove(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    await this.prisma.vacationSeniorityRule.delete({ where: { id } });
    return { ok: true };
  }
}
