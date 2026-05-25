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

  async healthCheck() {
    const count = await this.mdm.globalLegalEntity.count();
    return { ok: true, legalEntityCount: count };
  }
}
