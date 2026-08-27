import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertClinicCutoverDto } from "./dto/upsert-clinic-cutover.dto";
import { UpsertElektrawebBridgeDto } from "./dto/upsert-elektraweb-bridge.dto";

export type ElektrawebBridgeView = {
  organizationId: string;
  inboundEnabled: boolean;
  writeEnabled: boolean;
  elektrawebHotelId: number | null;
  spaDepId: number | null;
  spaCurrencyId: number | null;
  walkinResId: string | null;
  walkinResNameId: string | null;
  updatedAt: string | null;
};

export type ClinicCutoverView = {
  organizationId: string;
  elektrawebDualRun: boolean;
  hotelOrganizationId: string | null;
  updatedAt: string | null;
};

export type VendorBridgePolicyBundle = {
  organizationId: string;
  industries: string[];
  elektrawebBridge: ElektrawebBridgeView | null;
  clinicCutover: ClinicCutoverView | null;
};

@Injectable()
export class ElektrawebBridgePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getBundle(organizationId: string): Promise<VendorBridgePolicyBundle> {
    await this.requireOrg(organizationId);
    const industries = await this.resolveIndustries(organizationId);
    const [bridge, cutover] = await Promise.all([
      this.prisma.elektrawebBridgePolicy.findUnique({
        where: { organizationId },
      }),
      this.prisma.clinicCutoverPolicy.findUnique({
        where: { organizationId },
      }),
    ]);
    return {
      organizationId,
      industries,
      elektrawebBridge: bridge ? this.mapBridge(bridge) : null,
      clinicCutover: cutover ? this.mapCutover(cutover) : null,
    };
  }

  async upsertBridge(
    organizationId: string,
    dto: UpsertElektrawebBridgeDto,
  ): Promise<ElektrawebBridgeView> {
    await this.requireOrg(organizationId);
    const row = await this.prisma.elektrawebBridgePolicy.upsert({
      where: { organizationId },
      create: {
        organizationId,
        inboundEnabled: dto.inboundEnabled,
        writeEnabled: dto.writeEnabled,
        elektrawebHotelId: dto.elektrawebHotelId ?? null,
        spaDepId: dto.spaDepId ?? null,
        spaCurrencyId: dto.spaCurrencyId ?? null,
        walkinResId: this.nullIfEmpty(dto.walkinResId),
        walkinResNameId: this.nullIfEmpty(dto.walkinResNameId),
      },
      update: {
        inboundEnabled: dto.inboundEnabled,
        writeEnabled: dto.writeEnabled,
        elektrawebHotelId: dto.elektrawebHotelId ?? null,
        spaDepId: dto.spaDepId ?? null,
        spaCurrencyId: dto.spaCurrencyId ?? null,
        walkinResId: this.nullIfEmpty(dto.walkinResId),
        walkinResNameId: this.nullIfEmpty(dto.walkinResNameId),
      },
    });
    return this.mapBridge(row);
  }

  async getClinicCutover(organizationId: string): Promise<ClinicCutoverView> {
    await this.requireOrg(organizationId);
    const row = await this.prisma.clinicCutoverPolicy.findUnique({
      where: { organizationId },
    });
    if (!row) {
      return {
        organizationId,
        elektrawebDualRun: false,
        hotelOrganizationId: null,
        updatedAt: null,
      };
    }
    return this.mapCutover(row);
  }

  async upsertClinicCutover(
    organizationId: string,
    dto: UpsertClinicCutoverDto,
  ): Promise<ClinicCutoverView> {
    await this.requireOrg(organizationId);
    const hotelOrgId = dto.hotelOrganizationId ?? null;
    if (hotelOrgId) {
      if (hotelOrgId === organizationId) {
        throw new BadRequestException(
          "hotelOrganizationId cannot equal the clinic organization",
        );
      }
      const hotel = await this.prisma.organization.findUnique({
        where: { id: hotelOrgId },
        select: { id: true },
      });
      if (!hotel) {
        throw new BadRequestException("hotelOrganizationId not found");
      }
    }
    const row = await this.prisma.clinicCutoverPolicy.upsert({
      where: { organizationId },
      create: {
        organizationId,
        elektrawebDualRun: dto.elektrawebDualRun,
        hotelOrganizationId: hotelOrgId,
      },
      update: {
        elektrawebDualRun: dto.elektrawebDualRun,
        hotelOrganizationId: hotelOrgId,
      },
    });
    return this.mapCutover(row);
  }

  private async requireOrg(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
  }

  private async resolveIndustries(organizationId: string): Promise<string[]> {
    const eps = await this.prisma.satelliteEndpoint.findMany({
      where: { organizationId, enabled: true },
      select: { satelliteKey: true },
    });
    const industries: string[] = [];
    for (const ep of eps) {
      if (ep.satelliteKey === "industry_hotel_pms") industries.push("hotel");
      if (ep.satelliteKey === "industry_clinic") industries.push("clinic");
    }
    return [...new Set(industries)];
  }

  private mapBridge(row: {
    organizationId: string;
    inboundEnabled: boolean;
    writeEnabled: boolean;
    elektrawebHotelId: number | null;
    spaDepId: number | null;
    spaCurrencyId: number | null;
    walkinResId: string | null;
    walkinResNameId: string | null;
    updatedAt: Date;
  }): ElektrawebBridgeView {
    return {
      organizationId: row.organizationId,
      inboundEnabled: row.inboundEnabled,
      writeEnabled: row.writeEnabled,
      elektrawebHotelId: row.elektrawebHotelId,
      spaDepId: row.spaDepId,
      spaCurrencyId: row.spaCurrencyId,
      walkinResId: row.walkinResId,
      walkinResNameId: row.walkinResNameId,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapCutover(row: {
    organizationId: string;
    elektrawebDualRun: boolean;
    hotelOrganizationId: string | null;
    updatedAt: Date;
  }): ClinicCutoverView {
    return {
      organizationId: row.organizationId,
      elektrawebDualRun: row.elektrawebDualRun,
      hotelOrganizationId: row.hotelOrganizationId,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private nullIfEmpty(value: string | null | undefined): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
