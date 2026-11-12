import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import { encryptText, decryptText } from "../security/pii-crypto.util";
import { UpsertOrgAccessDto } from "./dto/upsert-org-access.dto";
import {
  ACCESS_CONNECTORS,
  accessConnector,
  sanitizePublicFields,
} from "./org-access-catalog";

export type OrgAccessRowView = {
  code: string;
  group: "bank" | "gov" | "other";
  active: boolean;
  hasSecret: boolean;
  fields: { key: string; max: number }[];
  saved: boolean;
  publicFields: Record<string, string>;
  secretSet: boolean;
};

@Injectable()
export class OrgAccessCredentialService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<{ items: OrgAccessRowView[] }> {
    await this.requireOrg(organizationId);
    const rows = await this.prisma.organizationAccessCredential.findMany({
      where: { organizationId },
    });
    const byCode = new Map(rows.map((row) => [row.connectorCode, row]));
    return {
      items: ACCESS_CONNECTORS.map((connector) => {
        const saved = byCode.get(connector.code);
        return {
          code: connector.code,
          group: connector.group,
          active: connector.active,
          hasSecret: connector.hasSecret,
          fields: connector.fields,
          saved: Boolean(saved),
          publicFields: (saved?.publicFields as Record<string, string> | null) ?? {},
          secretSet: Boolean(saved?.secretCipher),
        };
      }),
    };
  }

  async upsert(organizationId: string, code: string, dto: UpsertOrgAccessDto, actorUserId: string) {
    await this.requireOrg(organizationId);
    const connector = accessConnector(code);
    if (!connector) throw new BadRequestException("UNKNOWN_CONNECTOR");
    if (!connector.active) throw new BadRequestException("CONNECTOR_INACTIVE");
    let publicFields: Record<string, string>;
    try {
      publicFields = sanitizePublicFields(connector, dto.publicFields);
    } catch (err) {
      const message = err instanceof Error ? err.message : "BAD_FIELDS";
      throw new BadRequestException(message);
    }
    const secret = dto.secret?.trim();
    if (secret && !connector.hasSecret) {
      throw new BadRequestException("SECRET_NOT_USED");
    }
    const existing = await this.prisma.organizationAccessCredential.findUnique({
      where: { organizationId_connectorCode: { organizationId, connectorCode: code } },
    });
    const secretCipher = secret ? encryptText(secret) : existing?.secretCipher ?? null;
    if (Object.keys(publicFields).length === 0 && !secretCipher) {
      throw new BadRequestException("EMPTY_ACCESS");
    }
    const data = {
      publicFields: publicFields as Prisma.InputJsonValue,
      secretCipher,
    };
    const saved = await this.prisma.$transaction(async (tx) => {
      const row = existing
        ? await tx.organizationAccessCredential.update({
            where: { id: existing.id },
            data,
          })
        : await tx.organizationAccessCredential.create({
            data: { organizationId, connectorCode: code, ...data },
          });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          entityType: "OrganizationAccessCredential",
          entityId: row.id,
          action: existing ? "ACCESS_KEY_UPDATE" : "ACCESS_KEY_CREATE",
          newValues: {
            connectorCode: code,
            publicFields,
            secretSet: Boolean(row.secretCipher),
            secretReplaced: Boolean(secret),
          } as Prisma.InputJsonValue,
        },
      });
      return row;
    });
    return {
      code,
      saved: true,
      publicFields: saved.publicFields,
      secretSet: Boolean(saved.secretCipher),
    };
  }

  async checkStored(organizationId: string, code: string) {
    await this.requireOrg(organizationId);
    const connector = accessConnector(code);
    if (!connector) throw new BadRequestException("UNKNOWN_CONNECTOR");
    const row = await this.prisma.organizationAccessCredential.findUnique({
      where: { organizationId_connectorCode: { organizationId, connectorCode: code } },
    });
    if (!row) throw new NotFoundException("ACCESS_NOT_SAVED");
    return { status: "stored" as const, calledExternal: false as const };
  }

  /** Service-token read. Inactive connectors and missing rows are not found. Secret stays off admin list routes. */
  async resolveForService(organizationId: string, code: string) {
    const connector = accessConnector(code);
    if (!connector?.active) throw new NotFoundException("ACCESS_NOT_AVAILABLE");
    const row = await this.prisma.organizationAccessCredential.findUnique({
      where: { organizationId_connectorCode: { organizationId, connectorCode: code } },
    });
    if (!row) throw new NotFoundException("ACCESS_NOT_AVAILABLE");
    const secret = row.secretCipher ? decryptText(row.secretCipher) : null;
    return {
      code,
      publicFields: (row.publicFields as Record<string, string> | null) ?? {},
      secret,
    };
  }

  private async requireOrg(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
  }
}
