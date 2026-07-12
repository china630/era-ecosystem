import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, seedLandingModuleMarketing } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import type { PatchLandingModuleMarketingDto } from "./dto/patch-landing-module-marketing.dto";

function serializeLandingModule(row: {
  moduleSlug: string;
  sortOrder: number;
  names: unknown;
  descriptions: unknown;
  tasks: unknown;
}) {
  return {
    moduleSlug: row.moduleSlug,
    sortOrder: row.sortOrder,
    names: row.names,
    descriptions: row.descriptions,
    tasks: row.tasks,
  };
}

@Injectable()
export class LandingMarketingService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureSeeded() {
    const count = await this.prisma.landingModuleMarketing.count();
    if (count === 0) {
      await seedLandingModuleMarketing(this.prisma);
    }
  }

  async listPublicLandingModules() {
    await this.ensureSeeded();
    const rows = await this.prisma.landingModuleMarketing.findMany({
      orderBy: [{ sortOrder: "asc" }, { moduleSlug: "asc" }],
    });
    return { items: rows.map(serializeLandingModule) };
  }

  async listLandingModulesAdmin() {
    return this.listPublicLandingModules();
  }

  async patchLandingModuleMarketing(
    moduleSlug: string,
    dto: PatchLandingModuleMarketingDto,
  ) {
    await this.ensureSeeded();
    const existing = await this.prisma.landingModuleMarketing.findUnique({
      where: { moduleSlug },
    });
    if (!existing) {
      throw new NotFoundException(`Landing module ${moduleSlug} not found`);
    }
    const row = await this.prisma.landingModuleMarketing.update({
      where: { moduleSlug },
      data: {
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.names !== undefined
          ? { names: dto.names as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.descriptions !== undefined
          ? { descriptions: dto.descriptions as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.tasks !== undefined
          ? { tasks: dto.tasks as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    return serializeLandingModule(row);
  }
}
