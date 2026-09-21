import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { decryptText, encryptText } from "../security/pii-crypto.util";
import { UpsertFiscalHardwareDeviceDto } from "./dto/upsert-fiscal-hardware-device.dto";

export type FiscalHardwareDeviceView = {
  id: string;
  organizationId: string;
  kind: string;
  providerId: string;
  label: string;
  outletCode: string | null;
  registerCode: string | null;
  serial: string | null;
  externalIds: Record<string, string> | null;
  endpoint: string | null;
  hasSecrets: boolean;
  status: string;
  isOrgDefault: boolean;
  isOutletDefault: boolean;
  isRegisterDefault: boolean;
  updatedAt: string;
};

/** Sync payload — no secret plaintext in logs; secretsCipher passed for satellite vault. */
export type FiscalHardwareDeviceSyncRow = {
  id: string;
  organizationId: string;
  kind: "FISCAL_KKM" | "BANK_POS";
  providerId: string;
  label: string;
  outletCode: string | null;
  registerCode: string | null;
  serial: string | null;
  externalIds: Record<string, string> | null;
  endpoint: string | null;
  secretsCipher: string | null;
  status: "active" | "retired";
  isOrgDefault: boolean;
  isOutletDefault: boolean;
  isRegisterDefault: boolean;
};

@Injectable()
export class FiscalHardwareDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<FiscalHardwareDeviceView[]> {
    await this.requireOrg(organizationId);
    const rows = await this.prisma.fiscalHardwareDevice.findMany({
      where: { organizationId },
      orderBy: [{ kind: "asc" }, { label: "asc" }],
    });
    return rows.map((r) => this.mapView(r));
  }

  async listForSync(
    organizationId: string,
  ): Promise<FiscalHardwareDeviceSyncRow[]> {
    const rows = await this.prisma.fiscalHardwareDevice.findMany({
      where: { organizationId, status: "active" },
    });
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      kind: r.kind as "FISCAL_KKM" | "BANK_POS",
      providerId: r.providerId,
      label: r.label,
      outletCode: r.outletCode,
      registerCode: r.registerCode,
      serial: r.serial,
      externalIds: this.parseExternal(r.externalIdsJson),
      endpoint: r.endpoint,
      secretsCipher: r.secretsCipher,
      status: r.status as "active" | "retired",
      isOrgDefault: r.isOrgDefault,
      isOutletDefault: r.isOutletDefault,
      isRegisterDefault: r.isRegisterDefault,
    }));
  }

  async create(
    organizationId: string,
    dto: UpsertFiscalHardwareDeviceDto,
  ): Promise<FiscalHardwareDeviceView> {
    await this.requireOrg(organizationId);
    if (dto.isOrgDefault) {
      await this.clearOrgDefault(organizationId, dto.kind);
    }
    const row = await this.prisma.fiscalHardwareDevice.create({
      data: {
        organizationId,
        kind: dto.kind,
        providerId: dto.providerId.trim().toLowerCase(),
        label: dto.label.trim(),
        outletCode: this.nullIfEmpty(dto.outletCode),
        registerCode: this.nullIfEmpty(dto.registerCode),
        serial: this.nullIfEmpty(dto.serial),
        externalIdsJson: (dto.externalIds ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        endpoint: this.nullIfEmpty(dto.endpoint),
        secretsCipher: dto.secrets
          ? encryptText(JSON.stringify(dto.secrets))
          : null,
        status: dto.status ?? "active",
        isOrgDefault: dto.isOrgDefault ?? false,
        isOutletDefault: dto.isOutletDefault ?? false,
        isRegisterDefault: dto.isRegisterDefault ?? false,
      },
    });
    return this.mapView(row);
  }

  async update(
    organizationId: string,
    deviceId: string,
    dto: UpsertFiscalHardwareDeviceDto,
  ): Promise<FiscalHardwareDeviceView> {
    await this.requireOrg(organizationId);
    const existing = await this.prisma.fiscalHardwareDevice.findFirst({
      where: { id: deviceId, organizationId },
    });
    if (!existing) throw new NotFoundException("Fiscal device not found");
    if (dto.isOrgDefault) {
      await this.clearOrgDefault(organizationId, dto.kind, deviceId);
    }
    const row = await this.prisma.fiscalHardwareDevice.update({
      where: { id: deviceId },
      data: {
        kind: dto.kind,
        providerId: dto.providerId.trim().toLowerCase(),
        label: dto.label.trim(),
        outletCode: this.nullIfEmpty(dto.outletCode),
        registerCode: this.nullIfEmpty(dto.registerCode),
        serial: this.nullIfEmpty(dto.serial),
        externalIdsJson: (dto.externalIds ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        endpoint: this.nullIfEmpty(dto.endpoint),
        ...(dto.secrets !== undefined
          ? {
              secretsCipher: dto.secrets
                ? encryptText(JSON.stringify(dto.secrets))
                : null,
            }
          : {}),
        status: dto.status ?? existing.status,
        isOrgDefault: dto.isOrgDefault ?? existing.isOrgDefault,
        isOutletDefault: dto.isOutletDefault ?? existing.isOutletDefault,
        isRegisterDefault: dto.isRegisterDefault ?? existing.isRegisterDefault,
      },
    });
    return this.mapView(row);
  }

  async retire(organizationId: string, deviceId: string): Promise<FiscalHardwareDeviceView> {
    await this.requireOrg(organizationId);
    const existing = await this.prisma.fiscalHardwareDevice.findFirst({
      where: { id: deviceId, organizationId },
    });
    if (!existing) throw new NotFoundException("Fiscal device not found");
    const row = await this.prisma.fiscalHardwareDevice.update({
      where: { id: deviceId },
      data: { status: "retired", isOrgDefault: false },
    });
    return this.mapView(row);
  }

  /** Decrypt secrets for satellite Sync only (never return to Super-Admin UI). */
  decryptSecretsCipher(cipher: string | null): Record<string, string> | null {
    if (!cipher?.trim()) return null;
    try {
      const payload = decryptText(cipher);
      if (!payload) return null;
      return JSON.parse(payload) as Record<string, string>;
    } catch {
      return null;
    }
  }

  private async clearOrgDefault(
    organizationId: string,
    kind: string,
    exceptId?: string,
  ) {
    await this.prisma.fiscalHardwareDevice.updateMany({
      where: {
        organizationId,
        kind,
        isOrgDefault: true,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      data: { isOrgDefault: false },
    });
  }

  private async requireOrg(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
  }

  private nullIfEmpty(v?: string | null): string | null {
    const t = v?.trim();
    return t ? t : null;
  }

  private parseExternal(json: unknown): Record<string, string> | null {
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    return json as Record<string, string>;
  }

  private mapView(r: {
    id: string;
    organizationId: string;
    kind: string;
    providerId: string;
    label: string;
    outletCode: string | null;
    registerCode: string | null;
    serial: string | null;
    externalIdsJson: unknown;
    endpoint: string | null;
    secretsCipher: string | null;
    status: string;
    isOrgDefault: boolean;
    isOutletDefault: boolean;
    isRegisterDefault: boolean;
    updatedAt: Date;
  }): FiscalHardwareDeviceView {
    return {
      id: r.id,
      organizationId: r.organizationId,
      kind: r.kind,
      providerId: r.providerId,
      label: r.label,
      outletCode: r.outletCode,
      registerCode: r.registerCode,
      serial: r.serial,
      externalIds: this.parseExternal(r.externalIdsJson),
      endpoint: r.endpoint,
      hasSecrets: Boolean(r.secretsCipher),
      status: r.status,
      isOrgDefault: r.isOrgDefault,
      isOutletDefault: r.isOutletDefault,
      isRegisterDefault: r.isRegisterDefault,
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
