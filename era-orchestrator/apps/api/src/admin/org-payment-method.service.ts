import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { encryptText } from "../security/pii-crypto.util";
import {
  SATELLITE_KEYS,
  UpsertOrgPaymentMethodDto,
} from "./dto/upsert-org-payment-method.dto";

export type OrgPaymentMethodView = {
  id: string;
  organizationId: string;
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  sortOrder: number;
  active: boolean;
  systemKey: string | null;
  fiscalHint: string;
  fiscalDeviceId: string | null;
  satellites: string[];
  hasSecrets: boolean;
  updatedAt: string;
};

export type OrgPaymentMethodSyncRow = {
  id: string;
  organizationId: string;
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  sortOrder: number;
  active: boolean;
  systemKey: string | null;
  fiscalHint: "CASH" | "CARD" | "NONE";
  fiscalDeviceId: string | null;
  satellites: string[];
  secretsCipher: string | null;
};

const SEED: Array<{
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  sortOrder: number;
  fiscalHint: "CASH" | "CARD" | "NONE";
  satellites: string[];
}> = [
  {
    code: "CASH",
    nameAz: "Nağd",
    nameRu: "Наличные",
    nameEn: "Cash",
    sortOrder: 10,
    fiscalHint: "CASH",
    satellites: ["hotel", "clinic", "fnb", "retail"],
  },
  {
    code: "CARD",
    nameAz: "Kart",
    nameRu: "Карта",
    nameEn: "Card",
    sortOrder: 20,
    fiscalHint: "CARD",
    satellites: ["hotel", "clinic", "fnb", "retail"],
  },
  {
    code: "EPOINT",
    nameAz: "E-point",
    nameRu: "E-point",
    nameEn: "E-point",
    sortOrder: 30,
    fiscalHint: "CARD",
    satellites: ["hotel"],
  },
  {
    code: "BANK_TRANSFER",
    nameAz: "Köçürmə",
    nameRu: "Перевод",
    nameEn: "Bank transfer",
    sortOrder: 40,
    fiscalHint: "NONE",
    satellites: ["hotel", "clinic"],
  },
  {
    code: "DEPOSIT",
    nameAz: "Depozit",
    nameRu: "Депозит",
    nameEn: "Deposit",
    sortOrder: 50,
    fiscalHint: "NONE",
    satellites: ["hotel"],
  },
  {
    code: "CL_AGENCY",
    nameAz: "Agentlik CL",
    nameRu: "City Ledger агентства",
    nameEn: "Agency city ledger",
    sortOrder: 60,
    fiscalHint: "NONE",
    satellites: ["hotel"],
  },
  {
    code: "CL_COMPANY",
    nameAz: "Şirkət CL",
    nameRu: "City Ledger компании",
    nameEn: "Company city ledger",
    sortOrder: 70,
    fiscalHint: "NONE",
    satellites: ["hotel"],
  },
  {
    code: "LOYALTY_POINTS",
    nameAz: "Bonus",
    nameRu: "Баллы",
    nameEn: "Loyalty points",
    sortOrder: 80,
    fiscalHint: "NONE",
    satellites: ["hotel"],
  },
];

@Injectable()
export class OrgPaymentMethodService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<OrgPaymentMethodView[]> {
    await this.requireOrg(organizationId);
    await this.ensureSeed(organizationId);
    const rows = await this.prisma.orgPaymentMethod.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return rows.map((r) => this.mapView(r));
  }

  async listForSync(organizationId: string): Promise<OrgPaymentMethodSyncRow[]> {
    await this.ensureSeed(organizationId);
    const rows = await this.prisma.orgPaymentMethod.findMany({
      where: { organizationId, active: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      code: r.code,
      nameAz: r.nameAz,
      nameRu: r.nameRu,
      nameEn: r.nameEn,
      sortOrder: r.sortOrder,
      active: r.active,
      systemKey: r.systemKey,
      fiscalHint: r.fiscalHint as "CASH" | "CARD" | "NONE",
      fiscalDeviceId: r.fiscalDeviceId,
      satellites: this.parseSatellites(r.satellitesJson),
      secretsCipher: r.secretsCipher,
    }));
  }

  /**
   * Department with PARENT fiscal routing uses the parent's catalog.
   * STANDALONE / OWN uses its own rows.
   */
  async listForSyncResolved(organizationId: string): Promise<{
    catalogOrgId: string;
    methods: OrgPaymentMethodSyncRow[];
    fiscalRouting: string;
    parentOrgId: string | null;
  }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        operatingMode: true,
        fiscalRouting: true,
        parentOrgId: true,
      },
    });
    if (!org) throw new NotFoundException("Organization not found");
    const useParent =
      org.operatingMode === "DEPARTMENT" &&
      org.fiscalRouting === "PARENT" &&
      Boolean(org.parentOrgId);
    const catalogOrgId = useParent && org.parentOrgId ? org.parentOrgId : org.id;
    const methods = await this.listForSync(catalogOrgId);
    return {
      catalogOrgId,
      methods,
      fiscalRouting: org.fiscalRouting,
      parentOrgId: org.parentOrgId,
    };
  }

  async create(
    organizationId: string,
    dto: UpsertOrgPaymentMethodDto,
  ): Promise<OrgPaymentMethodView> {
    await this.requireOrg(organizationId);
    await this.ensureSeed(organizationId);
    const code = (dto.code ?? "").trim().toUpperCase();
    if (!code) throw new BadRequestException("code is required");
    const satellites = this.normalizeSatellites(dto.satellites);
    const row = await this.prisma.orgPaymentMethod.create({
      data: {
        organizationId,
        code,
        nameAz: dto.nameAz.trim(),
        nameRu: dto.nameRu.trim(),
        nameEn: dto.nameEn.trim(),
        sortOrder: dto.sortOrder ?? 100,
        active: dto.active ?? true,
        fiscalHint: dto.fiscalHint,
        fiscalDeviceId: dto.fiscalDeviceId ?? null,
        satellitesJson: satellites as unknown as Prisma.InputJsonValue,
        secretsCipher: dto.secrets
          ? encryptText(JSON.stringify(dto.secrets))
          : null,
      },
    });
    return this.mapView(row);
  }

  async update(
    organizationId: string,
    methodId: string,
    dto: UpsertOrgPaymentMethodDto,
  ): Promise<OrgPaymentMethodView> {
    const existing = await this.prisma.orgPaymentMethod.findFirst({
      where: { id: methodId, organizationId },
    });
    if (!existing) throw new NotFoundException("Payment method not found");
    const satellites = this.normalizeSatellites(dto.satellites);
    const data: Prisma.OrgPaymentMethodUpdateInput = {
      nameAz: dto.nameAz.trim(),
      nameRu: dto.nameRu.trim(),
      nameEn: dto.nameEn.trim(),
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      active: dto.active ?? existing.active,
      fiscalHint: dto.fiscalHint,
      fiscalDevice: dto.fiscalDeviceId
        ? { connect: { id: dto.fiscalDeviceId } }
        : { disconnect: true },
      satellitesJson: satellites as unknown as Prisma.InputJsonValue,
    };
    if (dto.secrets !== undefined) {
      data.secretsCipher = dto.secrets
        ? encryptText(JSON.stringify(dto.secrets))
        : null;
    }
    const row = await this.prisma.orgPaymentMethod.update({
      where: { id: methodId },
      data,
    });
    return this.mapView(row);
  }

  async deactivate(
    organizationId: string,
    methodId: string,
  ): Promise<OrgPaymentMethodView> {
    const existing = await this.prisma.orgPaymentMethod.findFirst({
      where: { id: methodId, organizationId },
    });
    if (!existing) throw new NotFoundException("Payment method not found");
    if (existing.systemKey) {
      const row = await this.prisma.orgPaymentMethod.update({
        where: { id: methodId },
        data: { active: false },
      });
      return this.mapView(row);
    }
    await this.prisma.orgPaymentMethod.delete({ where: { id: methodId } });
    return this.mapView({ ...existing, active: false });
  }

  private async ensureSeed(organizationId: string): Promise<void> {
    const count = await this.prisma.orgPaymentMethod.count({
      where: { organizationId },
    });
    if (count > 0) return;
    await this.prisma.orgPaymentMethod.createMany({
      data: SEED.map((row) => ({
        organizationId,
        code: row.code,
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
        sortOrder: row.sortOrder,
        active: true,
        systemKey: row.code,
        fiscalHint: row.fiscalHint,
        satellitesJson: row.satellites as unknown as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
  }

  private normalizeSatellites(raw: string[]): string[] {
    const allowed = new Set<string>(SATELLITE_KEYS);
    const out = [...new Set(raw.map((s) => s.trim().toLowerCase()).filter((s) => allowed.has(s)))];
    if (out.length === 0) {
      throw new BadRequestException("At least one satellite must be selected");
    }
    return out;
  }

  private parseSatellites(json: unknown): string[] {
    if (!Array.isArray(json)) return [];
    return json.filter((v): v is string => typeof v === "string");
  }

  private mapView(row: {
    id: string;
    organizationId: string;
    code: string;
    nameAz: string;
    nameRu: string;
    nameEn: string;
    sortOrder: number;
    active: boolean;
    systemKey: string | null;
    fiscalHint: string;
    fiscalDeviceId: string | null;
    satellitesJson: unknown;
    secretsCipher: string | null;
    updatedAt: Date;
  }): OrgPaymentMethodView {
    return {
      id: row.id,
      organizationId: row.organizationId,
      code: row.code,
      nameAz: row.nameAz,
      nameRu: row.nameRu,
      nameEn: row.nameEn,
      sortOrder: row.sortOrder,
      active: row.active,
      systemKey: row.systemKey,
      fiscalHint: row.fiscalHint,
      fiscalDeviceId: row.fiscalDeviceId,
      satellites: this.parseSatellites(row.satellitesJson),
      hasSecrets: Boolean(row.secretsCipher),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async requireOrg(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
  }
}
