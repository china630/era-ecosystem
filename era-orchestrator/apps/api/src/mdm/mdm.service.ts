import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BloodGroup,
  IdentifierTrust,
  MaritalStatus,
  PersonAddressKind,
  PersonIdentifierType,
  PersonSegment,
  StatisticalCategory,
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
import {
  formatPersonBirthDate,
  personCoreDemographicsWrite,
} from "./mdm-person-sex";
import {
  composePersonFullName,
  hasPersonNameInput,
  mergePersonNameParts,
  normalizeNationalityIso,
  resolveIncomingNameParts,
  splitFullNameToParts,
  type PersonNameParts,
} from "./mdm-person-name";
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

function maskIdentifierValue(value: string): string {
  const v = value.trim();
  if (v.length <= 4) return "****";
  return `${"*".repeat(Math.min(v.length - 4, 6))}${v.slice(-4)}`;
}

export type PersonHrAddressView = {
  kind: PersonAddressKind;
  line: string | null;
  city: string | null;
  region: string | null;
  postal: string | null;
};

export type PersonHrProfileView = {
  bloodGroup: BloodGroup;
  maritalStatus: MaritalStatus | null;
  education: string | null;
  specialty: string | null;
  statisticalCategories: StatisticalCategory[];
  photoStorageKey: string | null;
  addresses: PersonHrAddressView[];
};

const BLOOD_GROUPS = new Set(Object.values(BloodGroup));
const MARITAL_STATUSES = new Set(Object.values(MaritalStatus));
const STAT_CATEGORIES = new Set(Object.values(StatisticalCategory));
const ADDRESS_KINDS = new Set(Object.values(PersonAddressKind));

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

    const names = this.decryptPersonNameParts(person);
    if (!grant && input.requesterOrgId) {
      await this.ensurePendingAccessRequest(
        person.id,
        input.requesterOrgId.trim(),
        input.purpose ?? "identity_lookup",
      );
      return {
        found: true as const,
        globalPersonId: person.id,
        fullName: null,
        firstName: null,
        middleName: null,
        lastName: null,
        phone: null,
        sex: null,
        birthDate: null,
        masked: true,
      };
    }

    return {
      found: true as const,
      globalPersonId: person.id,
      fullName: names.fullName,
      firstName: names.firstName,
      middleName: names.middleName,
      lastName: names.lastName,
      phone: person.phoneCipher
        ? maskPhone(decryptText(person.phoneCipher))
        : null,
      sex: person.sex,
      birthDate: formatPersonBirthDate(person.birthDate),
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
  async upsertNaturalPerson(input: ResolvePersonInput) {
    return this.resolveOrCreatePerson(input, true);
  }

  private decryptPersonNameParts(person: {
    firstNameCipher?: string | null;
    middleNameCipher?: string | null;
    lastNameCipher?: string | null;
    fullNameCipher?: string | null;
  }): PersonNameParts & { fullName: string | null } {
    let firstName = person.firstNameCipher
      ? (decryptText(person.firstNameCipher) ?? "").trim() || null
      : null;
    let middleName = person.middleNameCipher
      ? (decryptText(person.middleNameCipher) ?? "").trim() || null
      : null;
    let lastName = person.lastNameCipher
      ? (decryptText(person.lastNameCipher) ?? "").trim() || null
      : null;
    if (!firstName && !lastName && person.fullNameCipher) {
      const split = splitFullNameToParts(decryptText(person.fullNameCipher));
      firstName = split.firstName;
      middleName = split.middleName;
      lastName = split.lastName;
    }
    const composed = composePersonFullName(firstName, middleName, lastName);
    const fullName =
      composed ||
      (person.fullNameCipher
        ? (decryptText(person.fullNameCipher) ?? "").trim() || null
        : null);
    return { firstName, middleName, lastName, fullName };
  }

  private nameCipherWriteData(parts: PersonNameParts & { fullName: string }) {
    return {
      firstNameCipher: parts.firstName ? encryptText(parts.firstName) : null,
      middleNameCipher: parts.middleName ? encryptText(parts.middleName) : null,
      lastNameCipher: parts.lastName ? encryptText(parts.lastName) : null,
      fullNameCipher: parts.fullName ? encryptText(parts.fullName) : null,
    };
  }

  private async resolveOrCreatePerson(
    input: ResolvePersonInput,
    allowSurrogate: boolean,
  ) {
    if (!hasPersonNameInput(input) && !input.globalPersonId?.trim()) {
      throw new BadRequestException(
        "firstName+lastName or fullName required",
      );
    }

    if (input.globalPersonId?.trim()) {
      const canonicalId = await this.resolveCanonicalPersonId(
        input.globalPersonId.trim(),
      );
      const identifiers = collectIdentifierInputs(input);
      await this.updatePersonDemographics(canonicalId, input, identifiers);
      return this.mapPersonResponse({ id: canonicalId });
    }

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

    const incoming = resolveIncomingNameParts(input);
    if (
      !incoming ||
      !composePersonFullName(
        incoming.firstName,
        incoming.middleName,
        incoming.lastName,
      )
    ) {
      throw new BadRequestException(
        "firstName+lastName or fullName required",
      );
    }
    const nameParts = mergePersonNameParts(
      { firstName: null, middleName: null, lastName: null },
      incoming,
    );
    if (!nameParts.fullName) {
      throw new BadRequestException(
        "firstName+lastName or fullName required",
      );
    }

    const nationalityIso =
      normalizeNationalityIso(input.nationality) ?? "AZ";
    const segment = inferPersonSegment(nationalityIso, identifiers);
    const finBlindIndex = finIdent ? blindIndexFin(finIdent.value) : null;

    const demo = personCoreDemographicsWrite({
      sex: input.sex,
      gender: input.gender,
      birthDate: input.birthDate,
    });

    const phoneTrim = input.phone?.trim();
    const created = await this.mdm.globalNaturalPerson.create({
      data: {
        finBlindIndex,
        finCipher: finIdent ? encryptText(finIdent.value.trim()) : null,
        ...this.nameCipherWriteData(nameParts),
        phoneCipher: phoneTrim ? encryptText(phoneTrim) : null,
        nationality: nationalityIso,
        personSegment: segment as PersonSegment,
        sex: demo.sex ?? "UNKNOWN",
        birthDate: demo.birthDate ?? null,
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
    const existing = await this.mdm.globalNaturalPerson.findUnique({
      where: { id: personId },
    });
    if (!existing) throw new NotFoundException("person not found");
    const demo = personCoreDemographicsWrite({
      sex: input.sex,
      gender: input.gender,
      birthDate: input.birthDate,
      existingSex: existing?.sex,
    });
    const existingParts = this.decryptPersonNameParts(existing);
    const incoming = resolveIncomingNameParts(input);
    const nameParts = mergePersonNameParts(
      {
        firstName: existingParts.firstName,
        middleName: existingParts.middleName,
        lastName: existingParts.lastName,
      },
      incoming ?? {},
    );
    const nationalityIso = normalizeNationalityIso(input.nationality);
    const segment = inferPersonSegment(
      nationalityIso ?? existing.nationality ?? undefined,
      identifiers,
    );
    const finIdent = identifiers.find((i) => i.type === "AZ_FIN");
    const phoneTrim = input.phone?.trim();
    await this.mdm.globalNaturalPerson.update({
      where: { id: personId },
      data: {
        ...this.nameCipherWriteData(nameParts),
        phoneCipher: phoneTrim ? encryptText(phoneTrim) : undefined,
        ...(nationalityIso ? { nationality: nationalityIso } : {}),
        personSegment: segment as PersonSegment,
        ...(demo.sex ? { sex: demo.sex } : {}),
        ...(demo.birthDate ? { birthDate: demo.birthDate } : {}),
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

  private async ensurePendingAccessRequest(
    personId: string,
    requesterOrgId: string,
    purpose: string,
  ) {
    const existing = await this.mdm.personAccessRequest.findFirst({
      where: { personId, requesterOrgId, status: "PENDING" },
    });
    if (existing) return existing;
    return this.mdm.personAccessRequest.create({
      data: { personId, requesterOrgId, purpose },
    });
  }

  /** Citizen consent portal — exchange guest QR for short-lived session token. */
  createConsentPortalSession(guestToken: string) {
    const verified = verifyGuestIdentityToken(guestToken);
    if (!verified) {
      throw new BadRequestException("invalid or expired guest token");
    }
    const expiresAt = defaultGuestIdentityExpiresAt(3600);
    const sessionToken = signGuestIdentityToken(
      verified.globalPersonId,
      expiresAt,
    );
    return {
      sessionToken,
      globalPersonId: verified.globalPersonId,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  assertConsentPortalSession(sessionToken: string): string {
    const verified = verifyGuestIdentityToken(sessionToken);
    if (!verified) {
      throw new BadRequestException("invalid or expired consent session");
    }
    return verified.globalPersonId;
  }

  async listPendingAccessRequestsForPerson(globalPersonId: string) {
    const personId = await this.resolveCanonicalPersonId(globalPersonId);
    const rows = await this.mdm.personAccessRequest.findMany({
      where: { personId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    const orgIds = [...new Set(rows.map((r) => r.requesterOrgId))];
    const orgs =
      orgIds.length > 0
        ? await this.controlPlane.organization.findMany({
            where: { id: { in: orgIds } },
            select: { id: true, name: true },
          })
        : [];
    const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));
    return {
      globalPersonId: personId,
      requests: rows.map((r) => ({
        id: r.id,
        requesterOrgId: r.requesterOrgId,
        requesterOrgName: orgNameById.get(r.requesterOrgId) ?? null,
        purpose: r.purpose,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async decidePersonAccessRequest(input: {
    requestId: string;
    globalPersonId: string;
    grant: boolean;
  }) {
    const personId = await this.resolveCanonicalPersonId(input.globalPersonId);
    const req = await this.mdm.personAccessRequest.findFirst({
      where: { id: input.requestId, personId },
    });
    if (!req || req.status !== "PENDING") {
      throw new NotFoundException("access request not found");
    }

    await this.mdm.$transaction(async (tx) => {
      await tx.personAccessRequest.update({
        where: { id: req.id },
        data: {
          status: input.grant ? "GRANTED" : "DENIED",
          decidedAt: new Date(),
        },
      });
      if (input.grant) {
        await tx.personAccessGrant.upsert({
          where: {
            personId_granteeOrgId: {
              personId,
              granteeOrgId: req.requesterOrgId,
            },
          },
          create: {
            personId,
            granteeOrgId: req.requesterOrgId,
          },
          update: {},
        });
      }
      await tx.personAccessLog.create({
        data: {
          personId,
          actorOrgId: req.requesterOrgId,
          action: input.grant ? "CONSENT_GRANTED" : "CONSENT_DENIED",
          metaJson: JSON.stringify({ requestId: req.id, purpose: req.purpose }),
        },
      });
    });

    return {
      ok: true,
      requestId: req.id,
      granted: input.grant,
    };
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

  /**
   * Internal org profile for satellite provisioning (e.g. Finance SSO ingress
   * provisions a local org row). Returns the decrypted VÖEN so the satellite can
   * key its local organization by the same legal identity. Service-token only.
   */
  async getOrganizationDetails(organizationId: string) {
    const id = organizationId.trim();
    if (!id) {
      throw new BadRequestException("organizationId required");
    }
    const org = await this.controlPlane.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    const legalEntity = await this.mdm.globalLegalEntity.findFirst({
      where: { organizationId: id },
      select: { taxIdCipher: true },
    });
    const taxId = legalEntity?.taxIdCipher
      ? decryptText(legalEntity.taxIdCipher)
      : null;
    return { organizationId: org.id, name: org.name, taxId };
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

  /**
   * Super-admin person directory. Decrypts name/phone for operators only.
   * FIN / DOB narrow in SQL; name/phone filter after decrypt (capped scan).
   */
  async listNaturalPersons(input: {
    page: number;
    pageSize: number;
    fin?: string;
    fullName?: string;
    phone?: string;
    birthDate?: string;
    includeMerged?: boolean;
  }) {
    const page = Math.max(1, input.page);
    const pageSize = Math.min(100, Math.max(1, input.pageSize));

    const where: {
      mergedIntoPersonId?: null;
      finBlindIndex?: string;
      birthDate?: Date;
    } = {};
    if (!input.includeMerged) {
      where.mergedIntoPersonId = null;
    }
    if (input.fin?.trim()) {
      const fin = input.fin.trim().toUpperCase();
      if (!FIN_PATTERN.test(fin)) {
        throw new BadRequestException("Invalid FIN format");
      }
      where.finBlindIndex = blindIndexFin(fin);
    }
    if (input.birthDate?.trim()) {
      const raw = input.birthDate.trim().slice(0, 10);
      const parts = raw.split("-").map(Number);
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
        where.birthDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      }
    }

    const nameQ = input.fullName?.trim().toLowerCase() ?? "";
    const phoneDigits = (input.phone ?? "").replace(/\D/g, "");
    const needsDecryptFilter = Boolean(nameQ || phoneDigits);

    type PersonRow = {
      id: string;
      firstNameCipher: string | null;
      middleNameCipher: string | null;
      lastNameCipher: string | null;
      fullNameCipher: string | null;
      phoneCipher: string | null;
      finCipher: string | null;
      sex: string;
      birthDate: Date | null;
      personSegment: string;
      mergedIntoPersonId: string | null;
      updatedAt: Date;
    };

    const mapItem = (r: PersonRow) => {
      const names = this.decryptPersonNameParts(r);
      const phonePlain = r.phoneCipher
        ? decryptText(r.phoneCipher)
        : null;
      const finPlain = r.finCipher ? decryptText(r.finCipher) : null;
      return {
        id: r.id,
        fullName: names.fullName,
        firstName: names.firstName,
        middleName: names.middleName,
        lastName: names.lastName,
        finMasked: finPlain ? maskIdentifierValue(finPlain) : null,
        phoneMasked: maskPhone(phonePlain),
        sex: r.sex,
        birthDate: formatPersonBirthDate(r.birthDate),
        personSegment: r.personSegment,
        mergedIntoPersonId: r.mergedIntoPersonId,
        updatedAt: r.updatedAt.toISOString(),
      };
    };

    const personSelect = {
      id: true,
      firstNameCipher: true,
      middleNameCipher: true,
      lastNameCipher: true,
      fullNameCipher: true,
      phoneCipher: true,
      finCipher: true,
      sex: true,
      birthDate: true,
      personSegment: true,
      mergedIntoPersonId: true,
      updatedAt: true,
    } as const;

    let items: ReturnType<typeof mapItem>[];
    let total: number;

    if (!needsDecryptFilter) {
      const [count, rows] = await Promise.all([
        this.mdm.globalNaturalPerson.count({ where }),
        this.mdm.globalNaturalPerson.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: personSelect,
        }),
      ]);
      total = count;
      items = rows.map(mapItem);
    } else {
      const candidates = await this.mdm.globalNaturalPerson.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 2000,
        select: personSelect,
      });
      const filtered = candidates.filter((r) => {
        if (nameQ) {
          const names = this.decryptPersonNameParts(r);
          const name = (names.fullName ?? "").toLowerCase();
          if (!name.includes(nameQ)) return false;
        }
        if (phoneDigits) {
          const phone = r.phoneCipher
            ? (decryptText(r.phoneCipher) ?? "").replace(/\D/g, "")
            : "";
          if (!phone.includes(phoneDigits)) return false;
        }
        return true;
      });
      total = filtered.length;
      items = filtered
        .slice((page - 1) * pageSize, page * pageSize)
        .map(mapItem);
    }

    return { total, page, pageSize, items };
  }

  async getPersonOpsProfile(personId: string, requesterOrgId?: string) {
    const profile = await this.resolveOpsProfileData(
      personId,
      requesterOrgId?.trim(),
    );
    const orgId = requesterOrgId?.trim();
    if (orgId) {
      await this.mdm.personAccessLog.create({
        data: {
          personId: profile.globalPersonId,
          actorOrgId: orgId,
          action: "OPS_PROFILE_READ",
          metaJson: JSON.stringify({ accessDenied: profile.accessDenied }),
        },
      });
    }
    return profile;
  }

  /** Compact table row for workforce HR screens (batch-friendly). */
  compactWorkforceDisplay(profile: {
    globalPersonId: string;
    fullName: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    identifiers: Array<{ maskedValue: string; isPrimary: boolean }>;
    accessDenied: boolean;
    hrProfile: PersonHrProfileView | null;
    sex?: string | null;
    birthDate?: string | null;
  }) {
    const primary =
      profile.identifiers.find((i) => i.isPrimary) ?? profile.identifiers[0];
    const composed = profile.accessDenied
      ? null
      : composePersonFullName(
          profile.firstName,
          profile.middleName,
          profile.lastName,
        ) || profile.fullName;
    return {
      globalPersonId: profile.globalPersonId,
      displayName: composed,
      firstName: profile.accessDenied ? null : (profile.firstName ?? null),
      middleName: profile.accessDenied ? null : (profile.middleName ?? null),
      lastName: profile.accessDenied ? null : (profile.lastName ?? null),
      primaryIdentifierMasked: primary?.maskedValue ?? null,
      accessDenied: profile.accessDenied,
      hrProfile: profile.accessDenied ? null : profile.hrProfile,
      sex: profile.accessDenied ? null : (profile.sex ?? null),
      birthDate: profile.accessDenied ? null : (profile.birthDate ?? null),
    };
  }

  async batchGetPersonOpsProfile(
    personIds: string[],
    organizationId: string,
  ): Promise<
    Record<
      string,
      {
        globalPersonId: string;
        displayName: string | null;
        firstName: string | null;
        middleName: string | null;
        lastName: string | null;
        primaryIdentifierMasked: string | null;
        accessDenied: boolean;
        hrProfile: PersonHrProfileView | null;
        sex: string | null;
        birthDate: string | null;
      }
    >
  > {
    const orgId = organizationId?.trim();
    if (!orgId) throw new BadRequestException("organizationId required");
    const unique = [...new Set(personIds.filter(Boolean))];
    const out: Record<
      string,
      {
        globalPersonId: string;
        displayName: string | null;
        firstName: string | null;
        middleName: string | null;
        lastName: string | null;
        primaryIdentifierMasked: string | null;
        accessDenied: boolean;
        hrProfile: PersonHrProfileView | null;
        sex: string | null;
        birthDate: string | null;
      }
    > = {};
    const BATCH = 100;
    for (let i = 0; i < unique.length; i += BATCH) {
      const chunk = unique.slice(i, i + BATCH);
      let logPersonId: string | null = null;
      for (const pid of chunk) {
        try {
          const profile = await this.resolveOpsProfileData(pid, orgId);
          if (!logPersonId) logPersonId = profile.globalPersonId;
          out[profile.globalPersonId] = this.compactWorkforceDisplay(profile);
        } catch {
          out[pid] = {
            globalPersonId: pid,
            displayName: null,
            firstName: null,
            middleName: null,
            lastName: null,
            primaryIdentifierMasked: null,
            accessDenied: true,
            hrProfile: null,
            sex: null,
            birthDate: null,
          };
        }
      }
      if (chunk.length > 0 && logPersonId) {
        await this.mdm.personAccessLog.create({
          data: {
            personId: logPersonId,
            actorOrgId: orgId,
            action: "WORKFORCE_OPS_PROFILE_BATCH",
            metaJson: JSON.stringify({ count: chunk.length, personIds: chunk }),
          },
        });
      }
    }
    return out;
  }

  /** Hire intake: resolve/create person + workforce access grant + ops profile. */
  async workforceResolvePerson(
    input: ResolvePersonInput & { organizationId: string },
  ) {
    const orgId = input.organizationId.trim();
    if (!orgId) throw new BadRequestException("organizationId required");

    let existingId: string | null = null;
    const identifiers = collectIdentifierInputs(input);
    for (const ident of identifiers) {
      const found = await this.findPersonByIdentifier(
        ident.type,
        ident.issuingCountry ?? "AZ",
        ident.value,
      );
      if (found) {
        existingId = await this.resolveCanonicalPersonId(found.id);
        break;
      }
    }

    const resolved = await this.resolveOrCreatePerson(input, true);
    await this.ensureWorkforceAccessGrant(resolved.globalPersonId, orgId);
    const profile = await this.resolveOpsProfileData(resolved.globalPersonId, orgId);
    return {
      globalPersonId: resolved.globalPersonId,
      created: !existingId,
      opsProfile: this.compactWorkforceDisplay(profile),
    };
  }

  async ensureWorkforceAccessGrant(personId: string, granteeOrgId: string) {
    const canonical = await this.resolveCanonicalPersonId(personId);
    await this.mdm.personAccessGrant.upsert({
      where: {
        personId_granteeOrgId: {
          personId: canonical,
          granteeOrgId: granteeOrgId.trim(),
        },
      },
      create: {
        personId: canonical,
        granteeOrgId: granteeOrgId.trim(),
      },
      update: {},
    });
  }

  private async resolveOpsProfileData(
    personId: string,
    requesterOrgId?: string,
  ) {
    const canonical = await this.resolveCanonicalPersonId(personId);
    const person = await this.mdm.globalNaturalPerson.findUnique({
      where: { id: canonical },
    });
    if (!person) throw new NotFoundException("person not found");

    const orgId = requesterOrgId?.trim();
    const grant =
      orgId &&
      (await this.mdm.personAccessGrant.findUnique({
        where: {
          personId_granteeOrgId: { personId: canonical, granteeOrgId: orgId },
        },
      }));
    const accessDenied = Boolean(orgId && !grant);

    const rows = await this.mdm.personIdentifier.findMany({
      where: { personId: canonical },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    const identifiers = rows.map((row) => {
      if (accessDenied) {
        return {
          type: row.type,
          maskedValue: "***",
          issuingCountry: row.issuingCountry,
          isPrimary: row.isPrimary,
        };
      }
      const plain = decryptText(row.valueCipher) ?? "";
      return {
        type: row.type,
        maskedValue: maskIdentifierValue(plain),
        issuingCountry: row.issuingCountry,
        isPrimary: row.isPrimary,
      };
    });

    const hrProfile = accessDenied
      ? null
      : await this.loadHrProfileView(canonical);

    const names = accessDenied ? null : this.decryptPersonNameParts(person);

    return {
      globalPersonId: canonical,
      fullName: names?.fullName ?? null,
      firstName: names?.firstName ?? null,
      middleName: names?.middleName ?? null,
      lastName: names?.lastName ?? null,
      phoneMasked:
        !accessDenied && person.phoneCipher
          ? maskPhone(decryptText(person.phoneCipher))
          : null,
      sex: accessDenied ? null : person.sex,
      birthDate: accessDenied ? null : formatPersonBirthDate(person.birthDate),
      identifiers,
      accessDenied,
      hrProfile,
    };
  }

  private emptyHrProfileView(): PersonHrProfileView {
    return {
      bloodGroup: BloodGroup.UNKNOWN,
      maritalStatus: null,
      education: null,
      specialty: null,
      statisticalCategories: [],
      photoStorageKey: null,
      addresses: [],
    };
  }

  private async loadHrProfileView(personId: string): Promise<PersonHrProfileView> {
    const [row, addresses] = await Promise.all([
      this.mdm.personHrProfile.findUnique({ where: { personId } }),
      this.mdm.personAddress.findMany({
        where: { personId },
        orderBy: { kind: "asc" },
      }),
    ]);
    if (!row) {
      return {
        ...this.emptyHrProfileView(),
        addresses: addresses.map((a) => ({
          kind: a.kind,
          line: (decryptText(a.lineCipher) ?? "").trim() || null,
          city: a.cityCipher
            ? (decryptText(a.cityCipher) ?? "").trim() || null
            : null,
          region: a.regionCipher
            ? (decryptText(a.regionCipher) ?? "").trim() || null
            : null,
          postal: a.postalCipher
            ? (decryptText(a.postalCipher) ?? "").trim() || null
            : null,
        })),
      };
    }
    return {
      bloodGroup: row.bloodGroup,
      maritalStatus: row.maritalStatus,
      education: row.educationCipher
        ? (decryptText(row.educationCipher) ?? "").trim() || null
        : null,
      specialty: row.specialtyCipher
        ? (decryptText(row.specialtyCipher) ?? "").trim() || null
        : null,
      statisticalCategories: row.statisticalCategories ?? [],
      photoStorageKey: row.photoStorageKey,
      addresses: addresses.map((a) => ({
        kind: a.kind,
        line: (decryptText(a.lineCipher) ?? "").trim() || null,
        city: a.cityCipher
          ? (decryptText(a.cityCipher) ?? "").trim() || null
          : null,
        region: a.regionCipher
          ? (decryptText(a.regionCipher) ?? "").trim() || null
          : null,
        postal: a.postalCipher
          ? (decryptText(a.postalCipher) ?? "").trim() || null
          : null,
      })),
    };
  }

  private async assertPersonAccessGrant(personId: string, organizationId: string) {
    const orgId = organizationId.trim();
    if (!orgId) throw new BadRequestException("organizationId required");
    const grant = await this.mdm.personAccessGrant.findUnique({
      where: {
        personId_granteeOrgId: { personId, granteeOrgId: orgId },
      },
    });
    if (!grant) {
      return { accessDenied: true as const, orgId };
    }
    return { accessDenied: false as const, orgId };
  }

  async getPersonHrProfile(personId: string, organizationId: string) {
    const canonical = await this.resolveCanonicalPersonId(personId);
    const person = await this.mdm.globalNaturalPerson.findUnique({
      where: { id: canonical },
    });
    if (!person) throw new NotFoundException("person not found");

    const gate = await this.assertPersonAccessGrant(canonical, organizationId);
    if (gate.accessDenied) {
      return {
        globalPersonId: canonical,
        accessDenied: true as const,
        hrProfile: null,
      };
    }

    await this.mdm.personAccessLog.create({
      data: {
        personId: canonical,
        actorOrgId: gate.orgId,
        action: "HR_PROFILE_READ",
        metaJson: JSON.stringify({}),
      },
    });

    return {
      globalPersonId: canonical,
      accessDenied: false as const,
      hrProfile: await this.loadHrProfileView(canonical),
    };
  }

  async patchPersonHrProfile(
    personId: string,
    organizationId: string,
    body: {
      bloodGroup?: string;
      maritalStatus?: string | null;
      education?: string | null;
      specialty?: string | null;
      statisticalCategories?: string[];
      photoStorageKey?: string | null;
      addresses?: Array<{
        kind: string;
        line?: string | null;
        city?: string | null;
        region?: string | null;
        postal?: string | null;
      }>;
    },
  ) {
    const canonical = await this.resolveCanonicalPersonId(personId);
    const person = await this.mdm.globalNaturalPerson.findUnique({
      where: { id: canonical },
    });
    if (!person) throw new NotFoundException("person not found");

    const gate = await this.assertPersonAccessGrant(canonical, organizationId);
    if (gate.accessDenied) {
      throw new BadRequestException("PersonAccessGrant required for organizationId");
    }

    let bloodGroup: BloodGroup | undefined;
    if (body.bloodGroup != null) {
      if (!BLOOD_GROUPS.has(body.bloodGroup as BloodGroup)) {
        throw new BadRequestException("invalid bloodGroup");
      }
      bloodGroup = body.bloodGroup as BloodGroup;
    }

    let maritalStatus: MaritalStatus | null | undefined;
    if (body.maritalStatus === null) maritalStatus = null;
    else if (body.maritalStatus != null) {
      if (!MARITAL_STATUSES.has(body.maritalStatus as MaritalStatus)) {
        throw new BadRequestException("invalid maritalStatus");
      }
      maritalStatus = body.maritalStatus as MaritalStatus;
    }

    let statisticalCategories: StatisticalCategory[] | undefined;
    if (body.statisticalCategories != null) {
      if (!Array.isArray(body.statisticalCategories)) {
        throw new BadRequestException("statisticalCategories must be an array");
      }
      for (const c of body.statisticalCategories) {
        if (!STAT_CATEGORIES.has(c as StatisticalCategory)) {
          throw new BadRequestException(`invalid statisticalCategory: ${c}`);
        }
      }
      statisticalCategories = body.statisticalCategories as StatisticalCategory[];
    }

    await this.mdm.$transaction(async (tx) => {
      await tx.personHrProfile.upsert({
        where: { personId: canonical },
        create: {
          personId: canonical,
          bloodGroup: bloodGroup ?? BloodGroup.UNKNOWN,
          maritalStatus: maritalStatus === undefined ? null : maritalStatus,
          educationCipher:
            body.education != null && body.education.trim()
              ? encryptText(body.education.trim())
              : null,
          specialtyCipher:
            body.specialty != null && body.specialty.trim()
              ? encryptText(body.specialty.trim())
              : null,
          statisticalCategories: statisticalCategories ?? [],
          photoStorageKey: body.photoStorageKey ?? null,
        },
        update: {
          ...(bloodGroup !== undefined ? { bloodGroup } : {}),
          ...(maritalStatus !== undefined ? { maritalStatus } : {}),
          ...(body.education !== undefined
            ? {
                educationCipher:
                  body.education != null && body.education.trim()
                    ? encryptText(body.education.trim())
                    : null,
              }
            : {}),
          ...(body.specialty !== undefined
            ? {
                specialtyCipher:
                  body.specialty != null && body.specialty.trim()
                    ? encryptText(body.specialty.trim())
                    : null,
              }
            : {}),
          ...(statisticalCategories !== undefined
            ? { statisticalCategories }
            : {}),
          ...(body.photoStorageKey !== undefined
            ? { photoStorageKey: body.photoStorageKey }
            : {}),
        },
      });

      if (body.addresses != null) {
        for (const addr of body.addresses) {
          if (!ADDRESS_KINDS.has(addr.kind as PersonAddressKind)) {
            throw new BadRequestException(`invalid address kind: ${addr.kind}`);
          }
          const kind = addr.kind as PersonAddressKind;
          const line = (addr.line ?? "").trim();
          if (!line) {
            await tx.personAddress.deleteMany({
              where: { personId: canonical, kind },
            });
            continue;
          }
          await tx.personAddress.upsert({
            where: {
              personId_kind: { personId: canonical, kind },
            },
            create: {
              personId: canonical,
              kind,
              lineCipher: encryptText(line),
              cityCipher:
                addr.city != null && addr.city.trim()
                  ? encryptText(addr.city.trim())
                  : null,
              regionCipher:
                addr.region != null && addr.region.trim()
                  ? encryptText(addr.region.trim())
                  : null,
              postalCipher:
                addr.postal != null && addr.postal.trim()
                  ? encryptText(addr.postal.trim())
                  : null,
            },
            update: {
              lineCipher: encryptText(line),
              cityCipher:
                addr.city != null && addr.city.trim()
                  ? encryptText(addr.city.trim())
                  : null,
              regionCipher:
                addr.region != null && addr.region.trim()
                  ? encryptText(addr.region.trim())
                  : null,
              postalCipher:
                addr.postal != null && addr.postal.trim()
                  ? encryptText(addr.postal.trim())
                  : null,
            },
          });
        }
      }
    });

    await this.mdm.personAccessLog.create({
      data: {
        personId: canonical,
        actorOrgId: gate.orgId,
        action: "HR_PROFILE_PATCH",
        metaJson: JSON.stringify({
          fields: Object.keys(body).filter(
            (k) => (body as Record<string, unknown>)[k] !== undefined,
          ),
        }),
      },
    });

    return {
      globalPersonId: canonical,
      accessDenied: false as const,
      hrProfile: await this.loadHrProfileView(canonical),
    };
  }

  async resolveIdentifierForCompliance(
    personId: string,
    requesterOrgId: string,
  ) {
    const canonical = await this.resolveCanonicalPersonId(personId);
    const orgId = requesterOrgId.trim();
    if (!orgId) throw new BadRequestException("organizationId required");

    const grant = await this.mdm.personAccessGrant.findUnique({
      where: {
        personId_granteeOrgId: { personId: canonical, granteeOrgId: orgId },
      },
    });
    if (!grant) {
      return {
        globalPersonId: canonical,
        fin: null as string | null,
        passportNumber: null as string | null,
        issuingCountry: null as string | null,
        accessDenied: true as const,
      };
    }

    await this.mdm.personAccessLog.create({
      data: {
        personId: canonical,
        actorOrgId: orgId,
        action: "COMPLIANCE_RESOLVE",
        metaJson: JSON.stringify({ purpose: "export" }),
      },
    });

    const rows = await this.mdm.personIdentifier.findMany({
      where: { personId: canonical },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    let fin: string | null = null;
    let passportNumber: string | null = null;
    let issuingCountry: string | null = null;

    for (const row of rows) {
      const plain = (decryptText(row.valueCipher) ?? "").trim();
      if (row.type === "AZ_FIN" && !fin) fin = plain;
      if (row.type === "PASSPORT" && !passportNumber) {
        passportNumber = plain;
        issuingCountry = row.issuingCountry;
      }
    }

    return {
      globalPersonId: canonical,
      fin,
      passportNumber,
      issuingCountry,
      accessDenied: false as const,
    };
  }
}
