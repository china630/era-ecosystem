import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { ControlPlanePrismaService } from "../prisma/control-plane-prisma.service";
import { MdmPrismaService } from "../prisma/mdm-prisma.service";
import {
  blindIndexFin,
  encryptText,
} from "../common/utils/mdm-crypto.util";
import { decryptText } from "../security/pii-crypto.util";
import { blindIndexForVoen } from "../common/utils/voen-blind-index";
import {
  defaultGuestIdentityExpiresAt,
  signGuestIdentityToken,
  verifyGuestIdentityToken,
} from "../common/utils/guest-identity.util";
import {
  assertInternalServiceToken,
  maskPhone,
} from "../common/utils/internal-service-token.util";
import * as QRCode from "qrcode";

const FIN_PATTERN = /^[0-9A-HJ-NP-Za-hj-np-z]{7}$/;

@Injectable()
export class MdmService {
  constructor(
    private readonly mdm: MdmPrismaService,
    private readonly controlPlane: ControlPlanePrismaService,
  ) {}

  assertServiceToken(authorization: string | undefined): void {
    assertInternalServiceToken(authorization, "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN");
  }

  async registerOrganization(input: {
    name: string;
    taxId: string;
    ownerUserId?: string;
  }) {
    const taxId = input.taxId.trim();
    const name = input.name.trim();
    if (!taxId || !name) {
      throw new BadRequestException("name and taxId required");
    }

    const taxIdBlindIndex = blindIndexForVoen(
      taxId,
      process.env.PII_BLIND_INDEX_KEY,
    );

    const existingOrg = await this.controlPlane.organization.findFirst({
      where: { taxIdBlindIndex },
    });
    if (existingOrg) {
      throw new ConflictException("VÖEN already registered");
    }

    const existingMdm = await this.mdm.globalLegalEntity.findUnique({
      where: { taxIdBlindIndex },
    });
    if (existingMdm) {
      throw new ConflictException("VÖEN already in MDM");
    }

    const org = await this.controlPlane.organization.create({
      data: {
        name,
        taxIdBlindIndex,
        ownerId: input.ownerUserId ?? null,
      },
    });

    const legalEntity = await this.mdm.globalLegalEntity.create({
      data: {
        taxIdBlindIndex,
        taxIdCipher: encryptText(taxId),
        nameCipher: encryptText(name),
        organizationId: org.id,
      },
    });

    return { organizationId: org.id, globalLegalEntityId: legalEntity.id };
  }

  async lookupNaturalPersonByFin(input: {
    fin: string;
    requesterOrgId?: string;
    purpose?: string;
  }) {
    const fin = input.fin.trim().toUpperCase();
    if (!FIN_PATTERN.test(fin)) {
      throw new BadRequestException("Invalid FIN format");
    }
    const finBlindIndex = blindIndexFin(fin);
    const person = await this.mdm.globalNaturalPerson.findUnique({
      where: { finBlindIndex },
    });
    if (!person) {
      return { found: false as const };
    }

    await this.logPersonAccess(person.id, input);

    const grant =
      input.requesterOrgId?.trim()
        ? await this.mdm.personAccessGrant.findUnique({
            where: {
              personId_granteeOrgId: {
                personId: person.id,
                granteeOrgId: input.requesterOrgId.trim(),
              },
            },
          })
        : null;

    const fullName = person.fullNameCipher
      ? decryptText(person.fullNameCipher)
      : null;
    if (!grant && input.requesterOrgId) {
      return {
        found: true as const,
        globalPersonId: person.id,
        fullName: null,
        phone: null,
        masked: true,
      };
    }

    return {
      found: true as const,
      globalPersonId: person.id,
      fullName: fullName?.trim() || null,
      phone: person.phoneCipher
        ? maskPhone(decryptText(person.phoneCipher))
        : null,
      masked: false,
    };
  }

  private async logPersonAccess(
    personId: string,
    input: { requesterOrgId?: string; purpose?: string },
  ) {
    const actorOrgId = input.requesterOrgId?.trim();
    if (!actorOrgId) return;
    await this.mdm.personAccessLog.create({
      data: {
        personId,
        actorOrgId,
        action: "LOOKUP_BY_FIN",
        metaJson: JSON.stringify({
          purpose: input.purpose ?? "unspecified",
        }),
      },
    });
  }

  async upsertNaturalPerson(input: {
    fin?: string;
    fullName: string;
    phone?: string;
  }) {
    const fullName = input.fullName.trim();
    if (!fullName) throw new BadRequestException("fullName required");

    const finBlindIndex = input.fin?.trim()
      ? blindIndexFin(input.fin)
      : null;

    if (finBlindIndex) {
      const existing = await this.mdm.globalNaturalPerson.findUnique({
        where: { finBlindIndex },
      });
      if (existing) return this.mapPersonResponse(existing);
    }

    const created = await this.mdm.globalNaturalPerson.create({
      data: {
        finBlindIndex,
        finCipher: input.fin ? encryptText(input.fin.trim()) : null,
        fullNameCipher: encryptText(fullName),
        phoneCipher: input.phone ? encryptText(input.phone.trim()) : null,
      },
    });
    return this.mapPersonResponse(created);
  }

  private mapPersonResponse(person: { id: string }) {
    return { id: person.id, globalPersonId: person.id };
  }

  async issueGuestQr(input: { globalPersonId: string; ttlSeconds?: number }) {
    const person = await this.mdm.globalNaturalPerson.findUnique({
      where: { id: input.globalPersonId },
    });
    if (!person) throw new BadRequestException("person not found");
    const expiresAt = defaultGuestIdentityExpiresAt(input.ttlSeconds);
    const token = signGuestIdentityToken(person.id, expiresAt);
    const qrPayload = `era://guest/${token}`;
    const qrPng = await QRCode.toBuffer(qrPayload, {
      type: "png",
      width: 320,
      margin: 2,
    });
    return {
      globalPersonId: person.id,
      token,
      expiresAt,
      qrPayload,
      qrPngBase64: qrPng.toString("base64"),
    };
  }

  async verifyGuestQr(input: { token: string }) {
    const verified = verifyGuestIdentityToken(input.token?.trim() ?? "");
    if (!verified) throw new BadRequestException("invalid or expired token");
    return verified;
  }

  async createAccessRequestStub(input: {
    personId: string;
    requesterOrgId: string;
    purpose: string;
  }) {
    return this.mdm.personAccessRequest.create({
      data: input,
    });
  }

  async linkExistingOrganization(input: {
    organizationId: string;
    name: string;
    taxId: string;
  }) {
    const taxId = input.taxId.trim();
    const name = input.name.trim();
    if (!taxId || !name || !input.organizationId) {
      throw new BadRequestException("organizationId, name, taxId required");
    }
    const taxIdBlindIndex = blindIndexForVoen(
      taxId,
      process.env.PII_BLIND_INDEX_KEY,
    );
    const legalEntity = await this.mdm.globalLegalEntity.upsert({
      where: { taxIdBlindIndex },
      create: {
        taxIdBlindIndex,
        taxIdCipher: encryptText(taxId),
        nameCipher: encryptText(name),
        organizationId: input.organizationId,
      },
      update: {
        nameCipher: encryptText(name),
        organizationId: input.organizationId,
      },
    });
    return {
      organizationId: input.organizationId,
      globalLegalEntityId: legalEntity.id,
    };
  }

  async lookupOrganizationByVoen(taxId: string) {
    const normalized = taxId.trim();
    if (!normalized) {
      throw new BadRequestException("taxId required");
    }
    const taxIdBlindIndex = blindIndexForVoen(
      normalized,
      process.env.PII_BLIND_INDEX_KEY,
    );
    const legalEntity = await this.mdm.globalLegalEntity.findUnique({
      where: { taxIdBlindIndex },
      select: { id: true, organizationId: true },
    });
    if (!legalEntity) {
      return { organizationId: null, globalLegalEntityId: null };
    }
    return {
      organizationId: legalEntity.organizationId,
      globalLegalEntityId: legalEntity.id,
    };
  }

  async healthCheck() {
    const count = await this.mdm.globalLegalEntity.count();
    return { ok: true, legalEntityCount: count };
  }

  async listLegalEntities(input: { page: number; pageSize: number }) {
    const page = Math.max(1, input.page);
    const pageSize = Math.min(100, Math.max(1, input.pageSize));
    const [total, rows] = await Promise.all([
      this.mdm.globalLegalEntity.count(),
      this.mdm.globalLegalEntity.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          organizationId: true,
          taxIdBlindIndex: true,
          nameCipher: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      taxId: r.taxIdBlindIndex.slice(0, 12) + "…",
      name: decryptText(r.nameCipher) ?? "(encrypted)",
      updatedAt: r.updatedAt.toISOString(),
    }));
    return { total, page, pageSize, items };
  }
}
