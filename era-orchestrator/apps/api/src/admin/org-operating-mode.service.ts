import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DepartmentProvisionService } from "../subscription/department-provision.service";
import {
  OrgOperatingModeDto,
  OrgRoutingDto,
  SetOperatingModeDto,
} from "./dto/set-operating-mode.dto";

export type OperatingModeView = {
  organizationId: string;
  mode: OrgOperatingModeDto;
  parentOrgId: string | null;
  fiscalRouting: OrgRoutingDto;
  revenueRouting: OrgRoutingDto;
};

@Injectable()
export class OrgOperatingModeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentProvision: DepartmentProvisionService,
  ) {}

  async get(organizationId: string): Promise<OperatingModeView> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        operatingMode: true,
        parentOrgId: true,
        fiscalRouting: true,
        revenueRouting: true,
      },
    });
    if (!org) throw new NotFoundException("Organization not found");
    return {
      organizationId: org.id,
      mode: org.operatingMode as OrgOperatingModeDto,
      parentOrgId: org.parentOrgId,
      fiscalRouting: org.fiscalRouting as OrgRoutingDto,
      revenueRouting: org.revenueRouting as OrgRoutingDto,
    };
  }

  async set(
    organizationId: string,
    dto: SetOperatingModeDto,
  ): Promise<OperatingModeView> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    if (dto.mode === OrgOperatingModeDto.STANDALONE) {
      // Standalone always owns its own money; clear parent linkage.
      return this.persist(organizationId, {
        mode: OrgOperatingModeDto.STANDALONE,
        parentOrgId: null,
        fiscalRouting: OrgRoutingDto.OWN,
        revenueRouting: OrgRoutingDto.OWN,
      });
    }

    // DEPARTMENT
    if (!dto.parentOrgId) {
      throw new BadRequestException("parentOrgId is required for DEPARTMENT mode");
    }
    if (dto.parentOrgId === organizationId) {
      throw new BadRequestException("An organization cannot be its own parent");
    }
    const parent = await this.prisma.organization.findUnique({
      where: { id: dto.parentOrgId },
      select: { id: true, operatingMode: true },
    });
    if (!parent) throw new BadRequestException("Parent organization not found");
    if (parent.operatingMode === "DEPARTMENT") {
      // Keep the hierarchy flat: a department cannot be a parent.
      throw new BadRequestException("Parent organization is itself a department");
    }

    await this.departmentProvision.snapshotFromParent(
      organizationId,
      dto.parentOrgId,
    );

    return this.persist(organizationId, {
      mode: OrgOperatingModeDto.DEPARTMENT,
      parentOrgId: dto.parentOrgId,
      fiscalRouting: dto.fiscalRouting ?? OrgRoutingDto.PARENT,
      revenueRouting: dto.revenueRouting ?? OrgRoutingDto.PARENT,
    });
  }

  /** Detach a department into a standalone org. No data migration is needed —
   * operational data already lives in the satellite's own DB; only money
   * routing flips back to OWN. Historical accounting stays with the parent. */
  async detach(organizationId: string): Promise<OperatingModeView> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    return this.persist(organizationId, {
      mode: OrgOperatingModeDto.STANDALONE,
      parentOrgId: null,
      fiscalRouting: OrgRoutingDto.OWN,
      revenueRouting: OrgRoutingDto.OWN,
    });
  }

  private async persist(
    organizationId: string,
    data: {
      mode: OrgOperatingModeDto;
      parentOrgId: string | null;
      fiscalRouting: OrgRoutingDto;
      revenueRouting: OrgRoutingDto;
    },
  ): Promise<OperatingModeView> {
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        operatingMode: data.mode,
        parentOrgId: data.parentOrgId,
        fiscalRouting: data.fiscalRouting,
        revenueRouting: data.revenueRouting,
      },
      select: {
        id: true,
        operatingMode: true,
        parentOrgId: true,
        fiscalRouting: true,
        revenueRouting: true,
      },
    });
    return {
      organizationId: updated.id,
      mode: updated.operatingMode as OrgOperatingModeDto,
      parentOrgId: updated.parentOrgId,
      fiscalRouting: updated.fiscalRouting as OrgRoutingDto,
      revenueRouting: updated.revenueRouting as OrgRoutingDto,
    };
  }
}
