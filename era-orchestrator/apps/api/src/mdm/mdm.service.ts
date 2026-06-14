import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  IdentifierTrust,
  PersonIdentifierType,
  PersonSegment,
} from "@era365/mdm-database";
import { ControlPlanePrismaService } from "../prisma/control-plane-prisma.service";
import { MdmPrismaService } from "../prisma/mdm-prisma.service";
import {
  blindIndexFin,
  blindIndexIdentifier,
  encryptText,
  normalizeCountryCode,
  type PersonIdentifierTypeKey,
} from "../common/utils/mdm-crypto.util";
import {
  collectIdentifierInputs,
  inferPersonSegment,
  type ResolvePersonInput,
} from "./mdm-person-identity.types";
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

  assertServiceToken(
    authorization: string | undefined,
    xServiceToken?: string,
  ): void {
    assertInternalServiceToken(
      authorization,
      "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
      xServiceToken,
    );
  }

  /** Follow merge alias chain to canonical person id. */
  async resolveCanonicalPersonId(personId: string): Promise<string> {
    let current = personId;
    for (let i = 0; i < 8; i++) {
      const row = await this.mdm.globalNaturalPerson.findUnique({
        where: { id: current },
        select: { mergedIntoPersonId: true },
      });
      if (!row?.mergedIntoPersonId) return current;
      current = row.mergedIntoPersonId;
    }
    return current;
  }

  private async findPersonByIdentifier(
    type: PersonIdentifierTypeKey,
    issuingCountry: string,
    value: string,
  ) {
    const blindIndex = blindIndexIdentifier(type, issuingCountry, value);
    const country = normalizeCountryCode(issuingCountry);
    const ident = await this.mdm.personIdentifier.findUnique({
      where: {
        type_issuingCountry_blindIndex: {
          type: type as PersonIdentifierType,
          issuingCountry: country,
          blindIndex,
        },
      },
      include: { person: true },
    });
    return ident?.person ?? null;
  }

  private async upsertIdentifierRow(
    personId: string,
    type: PersonIdentifierTypeKey,
    issuingCountry: string,
    value: string,
    isPrimary: boolean,
  ) {
    const country = normalizeCountryCode(issuingCountry);
    const blindIndex = blindIndexIdentifier(type, country, value);
    const existing = await this.mdm.personIdentifier.findUnique({
      where: {
        type_issuingCountry_blindIndex: {
          type: type as PersonIdentifierType,
          issuingCountry: country,
          blindIndex,
        },
      },
    });
    if (existing) {
      if (existing.personId !== personId) {
        throw new ConflictException(
          `Identifier ${type} already bound to another person`,
        );
      }
      return existing;
    }
    return this.mdm.personIdentifier.create({
      data: {
        personId,
        type: type as PersonIdentifierType,
        issuingCountry: country,
        valueCipher: encryptText(value.trim()),
        blindIndex,
        trust: IdentifierTrust.SELF_DECLARED,
        isPrimary,
      },
    });
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

  async resolvePersonIdentity(input: ResolvePersonInput) {
    return this.resolveOrCreatePerson(input, true);
  }

  /** @deprecated Prefer resolvePersonIdentity — kept for backward compatibility. */
  async upsertNaturalPerson(input: {
    fin?: string;
    fullName: string;
    phone?: string;
    passport?: string;
    issuingCountry?: string;
    nationality?: string;
  }) {
    return this.resolveOrCreatePerson(
      {
        fin: input.fin,
        fullName: input.fullName,
        phone: input.phone,
        passport: input.passport,
        issuingCountry: input.issuingCountry,
        nationality: input.nationality,
      },
      true,
    );
  }

  private async resolveOrCreatePerson(
    input: ResolvePersonInput,
    allowSurrogate: boolean,
  ) {
    const fullName = input.fullName.trim();
    if (!fullName) throw new BadRequestException("fullName required");

    const identifiers = collectIdentifierInputs(input);
    if (identifiers.length === 0 && !allowSurrogate) {
      throw new BadRequestException(
        "At least one identifier (fin, passport, residencePermit) required",
      );
    }

    for (const ident of identifiers) {
      const found = await this.findPersonByIdentifier(
        ident.type,
        ident.issuingCountry ?? "AZ",
        ident.value,
      );
      if (found) {
        const canonicalId = await this.resolveCanonicalPersonId(found.id);
        await this.updatePersonDemographics(canonicalId, input, identifiers);
        return this.mapPersonResponse({ id: canonicalId });
      }
    }

    const finIdent = identifiers.find((i) => i.type === "AZ_FIN");
    if (finIdent) {
      const legacy = await this.mdm.globalNaturalPerson.findUnique({
        where: { finBlindIndex: blindIndexFin(finIdent.value) },
      });
      if (legacy) {
        const canonicalId = await this.resolveCanonicalPersonId(legacy.id);
        await this.backfillIdentifiers(canonicalId, identifiers);
        await this.updatePersonDemographics(canonicalId, input, identifiers);
        return this.mapPersonResponse({ id: canonicalId });
      }
    }

    const segment = inferPersonSegment(input.nationality, identifiers);
    const finBlindIndex = finIdent ? blindIndexFin(finIdent.value) : null;

    const created = await this.mdm.globalNaturalPerson.create({
      data: {
        finBlindIndex,
        finCipher: finIdent ? encryptText(finIdent.value.trim()) : null,
        fullNameCipher: encryptText(fullName),
        phoneCipher: input.phone ? encryptText(input.phone.trim()) : null,
        nationality: (input.nationality ?? "AZ").trim().toUpperCase(),
        personSegment: segment as PersonSegment,
      },
    });

    let primarySet = false;
    for (const ident of identifiers) {
      await this.upsertIdentifierRow(
        created.id,
        ident.type,
        ident.issuingCountry ?? "AZ",
        ident.value,
        !primarySet,
      );
      primarySet = true;
    }

    if (identifiers.length === 0 && allowSurrogate) {
      const surrogateValue = `ERA-${created.id}`;
      await this.upsertIdentifierRow(
        created.id,
        "ERA_SURROGATE",
        "AZ",
        surrogateValue,
        true,
      );
    }

    return this.mapPersonResponse(created);
  }

  private async updatePersonDemographics(
    personId: string,
    input: ResolvePersonInput,
    identifiers: ReturnType<typeof collectIdentifierInputs>,
  ) {
    const segment = inferPersonSegment(input.nationality, identifiers);
    const finIdent = identifiers.find((i) => i.type === "AZ_FIN");
    await this.mdm.globalNaturalPerson.update({
      where: { id: personId },
      data: {
        fullNameCipher: encryptText(input.fullName.trim()),
        phoneCipher: input.phone
          ? encryptText(input.phone.trim())
          : undefined,
        nationality: input.nationality
          ? input.nationality.trim().toUpperCase()
          : undefined,
        personSegment: segment as PersonSegment,
        ...(finIdent
          ? {
              finBlindIndex: blindIndexFin(finIdent.value),
              finCipher: encryptText(finIdent.value.trim()),
            }
          : {}),
      },
    });
    await this.backfillIdentifiers(personId, identifiers);
  }

  private async backfillIdentifiers(
    personId: string,
    identifiers: ReturnType<typeof collectIdentifierInputs>,
  ) {
    let primarySet = await this.mdm.personIdentifier.count({
      where: { personId, isPrimary: true },
    });
    for (const ident of identifiers) {
      await this.upsertIdentifierRow(
        personId,
        ident.type,
        ident.issuingCountry ?? "AZ",
        ident.value,
        primarySet === 0,
      );
      if (primarySet === 0) primarySet = 1;
    }
  }

  async mergePersons(input: {
    sourcePersonId: string;
    targetPersonId: string;
    actorOrgId?: string;
  }) {
    const sourceId = input.sourcePersonId.trim();
    const targetId = input.targetPersonId.trim();
    if (!sourceId || !targetId || sourceId === targetId) {
      throw new BadRequestException("sourcePersonId and targetPersonId required");
    }

    const [source, target] = await Promise.all([
      this.mdm.globalNaturalPerson.findUnique({ where: { id: sourceId } }),
      this.mdm.globalNaturalPerson.findUnique({ where: { id: targetId } }),
    ]);
    if (!source || !target) throw new NotFoundException("Person not found");

    const canonicalTarget = await this.resolveCanonicalPersonId(targetId);
    if (source.mergedIntoPersonId) {
      throw new BadRequestException("Source person already merged");
    }

    await this.mdm.$transaction(async (tx) => {
      const sourceIdentifiers = await tx.personIdentifier.findMany({
        where: { personId: sourceId },
      });
      for (const ident of sourceIdentifiers) {
        const existing = await tx.personIdentifier.findUnique({
          where: {
            type_issuingCountry_blindIndex: {
              type: ident.type,
              issuingCountry: ident.issuingCountry,
              blindIndex: ident.blindIndex,
            },
          },
        });
        if (existing && existing.personId !== canonicalTarget) {
          await tx.personIdentifier.delete({ where: { id: ident.id } });
          continue;
        }
        if (!existing) {
          await tx.personIdentifier.update({
            where: { id: ident.id },
            data: { personId: canonicalTarget, isPrimary: false },
          });
        }
      }

      await tx.personAccessGrant.updateMany({
        where: { personId: sourceId },
        data: { personId: canonicalTarget },
      });
      await tx.personAccessLog.updateMany({
        where: { personId: sourceId },
        data: { personId: canonicalTarget },
      });

      await tx.globalNaturalPerson.update({
        where: { id: sourceId },
        data: {
          mergedIntoPersonId: canonicalTarget,
          personSegment: PersonSegment.CITIZEN,
        },
      });

      if (input.actorOrgId?.trim()) {
        await tx.personAccessLog.create({
          data: {
            personId: canonicalTarget,
            actorOrgId: input.actorOrgId.trim(),
            action: "MERGE_PERSON",
            metaJson: JSON.stringify({ sourcePersonId: sourceId }),
          },
        });
      }
    });

    return {
      sourcePersonId: sourceId,
      targetPersonId: canonicalTarget,
      globalPersonId: canonicalTarget,
    };
  }

  async listPersonIdentifiers(personId: string) {
    const canonical = await this.resolveCanonicalPersonId(personId);
    const rows = await this.mdm.personIdentifier.findMany({
      where: { personId: canonical },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        type: true,
        issuingCountry: true,
        trust: true,
        isPrimary: true,
        createdAt: true,
      },
    });
    return { globalPersonId: canonical, identifiers: rows };
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
    const orgIds = [
      ...new Set(
        rows
          .map((r) => r.organizationId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const orgRows =
      orgIds.length > 0
        ? await this.controlPlane.organization.findMany({
            where: { id: { in: orgIds } },
            select: { id: true, name: true },
          })
        : [];
    const orgNameById = new Map(orgRows.map((o) => [o.id, o.name]));

    const items = rows.map((r) => {
      const decryptedName = decryptText(r.nameCipher);
      const fallbackName = r.organizationId
        ? orgNameById.get(r.organizationId)
        : null;
      return {
        id: r.id,
        organizationId: r.organizationId,
        taxId: "(encrypted)",
        name: decryptedName ?? fallbackName ?? "(encrypted)",
        updatedAt: r.updatedAt.toISOString(),
      };
    });
    return { total, page, pageSize, items };
  }
}
