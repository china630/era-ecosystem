import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  OrgOperatingModeDto,
  OrgRoutingDto,
} from "./dto/set-operating-mode.dto";
import { OrgOperatingModeService } from "./org-operating-mode.service";
import { CreateDepartmentOrgDto } from "./dto/create-department-org.dto";

export type DepartmentOrgView = {
  id: string;
  name: string;
  operatingMode: string;
  parentOrgId: string | null;
  createdAt: Date;
};

@Injectable()
export class OrgDepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operatingMode: OrgOperatingModeService,
  ) {}

  async listForParent(parentOrgId: string): Promise<DepartmentOrgView[]> {
    const parent = await this.prisma.organization.findUnique({
      where: { id: parentOrgId },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException("Parent organization not found");

    const rows = await this.prisma.organization.findMany({
      where: { parentOrgId },
      select: {
        id: true,
        name: true,
        operatingMode: true,
        parentOrgId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return rows;
  }

  async createUnderParent(
    parentOrgId: string,
    dto: CreateDepartmentOrgDto,
  ): Promise<DepartmentOrgView> {
    const parent = await this.prisma.organization.findUnique({
      where: { id: parentOrgId },
      select: { id: true, operatingMode: true, ownerId: true, deploymentTopology: true },
    });
    if (!parent) throw new NotFoundException("Parent organization not found");
    if (parent.operatingMode === "DEPARTMENT") {
      throw new NotFoundException("Parent cannot be a department org");
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        ownerId: parent.ownerId,
        operatingMode: "STANDALONE",
        deploymentTopology: parent.deploymentTopology,
        fiscalRouting: "OWN",
        revenueRouting: "OWN",
      },
      select: {
        id: true,
        name: true,
        operatingMode: true,
        parentOrgId: true,
        createdAt: true,
      },
    });

    await this.operatingMode.set(org.id, {
      mode: OrgOperatingModeDto.DEPARTMENT,
      parentOrgId,
      fiscalRouting: OrgRoutingDto.PARENT,
      revenueRouting: OrgRoutingDto.PARENT,
    });

    const updated = await this.prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: {
        id: true,
        name: true,
        operatingMode: true,
        parentOrgId: true,
        createdAt: true,
      },
    });
    return updated;
  }
}
