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

@Injectable()
export class MdmService {
  constructor(
    private readonly mdm: MdmPrismaService,
    private readonly controlPlane: ControlPlanePrismaService,
  ) {}

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
      if (existing) return existing;
    }

    return this.mdm.globalNaturalPerson.create({
      data: {
        finBlindIndex,
        finCipher: input.fin ? encryptText(input.fin.trim()) : null,
        fullNameCipher: encryptText(fullName),
        phoneCipher: input.phone ? encryptText(input.phone.trim()) : null,
      },
    });
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
