import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OrgAddressKind,
  OrgContactKind,
  OrgContactPurpose,
  OrgOperatingMode,
  type OrganizationAddress,
  type OrganizationContactChannel,
  type OrganizationProfile,
} from "@era365/database";
import {
  organizationProfilePatchSchema,
  type OrganizationProfilePatch,
  type OrganizationProfileSnapshot,
} from "@era/contracts";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { decodeOrganizationTaxId } from "../security/pii-crypto.util";

const PHONE_KINDS = new Set<OrgContactKind>([
  OrgContactKind.PHONE,
  OrgContactKind.MOBILE,
  OrgContactKind.FAX,
  OrgContactKind.WHATSAPP,
]);

function assertAzPhone(value: string) {
  const v = value.trim();
  if (!/^\+994\d{9}$/.test(v)) {
    throw new BadRequestException({
      code: "INVALID_PHONE",
      message: "Phone must be +994 followed by 9 digits",
    });
  }
}

function assertEmail(value: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw new BadRequestException({
      code: "INVALID_EMAIL",
      message: "Invalid email",
    });
  }
}

function assertHttpUrl(value: string, field: string) {
  const v = value.trim();
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    throw new BadRequestException({
      code: "INVALID_URL",
      message: `${field} must be an http(s) URL`,
    });
  }
}

function assertPrimaryUnique<T extends { kind: string; isPrimary: boolean }>(
  rows: T[],
  label: string,
) {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.isPrimary) continue;
    if (seen.has(row.kind)) {
      throw new BadRequestException({
        code: "DUPLICATE_PRIMARY",
        message: `Only one primary ${label} allowed per kind (${row.kind})`,
      });
    }
    seen.add(row.kind);
  }
}

type ProfileBundle = OrganizationProfile & {
  contacts: OrganizationContactChannel[];
  addresses: OrganizationAddress[];
};

@Injectable()
export class OrganizationProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOrgMember(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { userId, organizationId },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException("Not a member of this organization");
    }
  }

  async getSnapshot(organizationId: string): Promise<OrganizationProfileSnapshot> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      include: {
        profile: { include: { contacts: true, addresses: true } },
        parentOrg: {
          include: {
            profile: { include: { contacts: true, addresses: true } },
          },
        },
      },
    });
    if (!org) throw new NotFoundException("Organization not found");
    return this.buildSnapshot(org);
  }

  async patchProfile(
    organizationId: string,
    actorUserId: string,
    raw: unknown,
  ): Promise<OrganizationProfileSnapshot> {
    const parsed = organizationProfilePatchSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION",
        message: parsed.error.message,
      });
    }
    const dto = parsed.data;
    this.validatePatchValues(dto);

    await this.prisma.organization.findFirstOrThrow({
      where: { id: organizationId, deletedAt: null },
      select: { id: true },
    });

    await this.prisma.organizationProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        tradeName: dto.tradeName ?? null,
        nameAz: dto.nameAz ?? null,
        nameRu: dto.nameRu ?? null,
        nameEn: dto.nameEn ?? null,
        directorName: dto.directorName ?? null,
        directorTitle: dto.directorTitle ?? null,
        logoUrl: dto.logoUrl ?? null,
        stampUrl: dto.stampUrl ?? null,
        signatureDirectorUrl: dto.signatureDirectorUrl ?? null,
        bankLine: dto.bankLine ?? null,
      },
      update: {
        ...(dto.tradeName !== undefined ? { tradeName: dto.tradeName } : {}),
        ...(dto.nameAz !== undefined ? { nameAz: dto.nameAz } : {}),
        ...(dto.nameRu !== undefined ? { nameRu: dto.nameRu } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
        ...(dto.directorName !== undefined
          ? { directorName: dto.directorName }
          : {}),
        ...(dto.directorTitle !== undefined
          ? { directorTitle: dto.directorTitle }
          : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.stampUrl !== undefined ? { stampUrl: dto.stampUrl } : {}),
        ...(dto.signatureDirectorUrl !== undefined
          ? { signatureDirectorUrl: dto.signatureDirectorUrl }
          : {}),
        ...(dto.bankLine !== undefined ? { bankLine: dto.bankLine } : {}),
      },
    });

    if (dto.contacts !== undefined) {
      assertPrimaryUnique(dto.contacts, "contact");
      await this.prisma.$transaction(async (tx) => {
        await tx.organizationContactChannel.deleteMany({
          where: { organizationId },
        });
        if (dto.contacts!.length) {
          await tx.organizationContactChannel.createMany({
            data: dto.contacts!.map((c, i) => ({
              organizationId,
              kind: c.kind as OrgContactKind,
              value: c.value.trim(),
              label: c.label?.trim() || null,
              purpose: (c.purpose ?? "GENERAL") as OrgContactPurpose,
              isPrimary: Boolean(c.isPrimary),
              sortOrder: c.sortOrder ?? i,
            })),
          });
        }
      });
    }

    if (dto.addresses !== undefined) {
      assertPrimaryUnique(dto.addresses, "address");
      await this.prisma.$transaction(async (tx) => {
        await tx.organizationAddress.deleteMany({ where: { organizationId } });
        if (dto.addresses!.length) {
          await tx.organizationAddress.createMany({
            data: dto.addresses!.map((a, i) => ({
              organizationId,
              kind: a.kind as OrgAddressKind,
              line1: a.line1.trim(),
              line2: a.line2?.trim() || null,
              city: a.city?.trim() || null,
              region: a.region?.trim() || null,
              postalCode: a.postalCode?.trim() || null,
              country: a.country?.trim() || "AZ",
              lineAz: a.lineAz?.trim() || null,
              lineRu: a.lineRu?.trim() || null,
              lineEn: a.lineEn?.trim() || null,
              isPrimary: Boolean(a.isPrimary),
              sortOrder: a.sortOrder ?? i,
            })),
          });
        }
      });
    }

    await this.prisma.auditLog
      .create({
        data: {
          organizationId,
          userId: actorUserId,
          action: "ORG_PROFILE_PATCHED",
          entityType: "ORGANIZATION_PROFILE",
          entityId: organizationId,
          newValues: dto as object,
        },
      })
      .catch(() => undefined);

    return this.getSnapshot(organizationId);
  }

  private validatePatchValues(dto: OrganizationProfilePatch) {
    for (const urlField of [
      "logoUrl",
      "stampUrl",
      "signatureDirectorUrl",
    ] as const) {
      const v = dto[urlField];
      if (v) assertHttpUrl(v, urlField);
    }
    for (const c of dto.contacts ?? []) {
      if (PHONE_KINDS.has(c.kind as OrgContactKind)) assertAzPhone(c.value);
      if (c.kind === "EMAIL") assertEmail(c.value);
      if (c.kind === "WEBSITE") assertHttpUrl(c.value, "website");
    }
  }

  private buildSnapshot(org: {
    id: string;
    name: string;
    currency: string;
    taxIdCipher: string | null;
    operatingMode: OrgOperatingMode;
    parentOrgId: string | null;
    profile: ProfileBundle | null;
    parentOrg: {
      id: string;
      name: string;
      taxIdCipher: string | null;
      profile: ProfileBundle | null;
    } | null;
  }): OrganizationProfileSnapshot {
    const own = org.profile;
    const parent = org.parentOrg?.profile ?? null;
    const isDept = org.operatingMode === OrgOperatingMode.DEPARTMENT;

    const inherited: OrganizationProfileSnapshot["inheritedFromParent"] = {};

    const legalName = org.name;
    const tradeName = own?.tradeName ?? null;
    const nameAz = own?.nameAz ?? parent?.nameAz ?? null;
    const nameRu = own?.nameRu ?? parent?.nameRu ?? null;
    const nameEn = own?.nameEn ?? parent?.nameEn ?? null;

    let taxId = decodeOrganizationTaxId(org) || "";
    if (!taxId && isDept && org.parentOrg) {
      taxId = decodeOrganizationTaxId(org.parentOrg) || "";
      inherited.taxId = true;
    }

    let logoUrl = own?.logoUrl ?? null;
    if (!logoUrl && isDept && parent?.logoUrl) {
      logoUrl = parent.logoUrl;
      inherited.logoUrl = true;
    }

    let bankLine = own?.bankLine ?? null;
    if (!bankLine && isDept && parent?.bankLine) {
      bankLine = parent.bankLine;
      inherited.bankLine = true;
    }

    // Own contacts always preferred when any exist; else inherit parent contacts for DEPARTMENT.
    let contacts = own?.contacts ?? [];
    if (contacts.length === 0 && isDept && parent?.contacts?.length) {
      contacts = parent.contacts;
    }

    let addresses = own?.addresses ?? [];
    if (addresses.length === 0 && isDept && parent?.addresses?.length) {
      addresses = parent.addresses;
      inherited.legalAddress = true;
    } else if (
      isDept &&
      !addresses.some((a) => a.kind === OrgAddressKind.LEGAL) &&
      parent?.addresses?.some((a) => a.kind === OrgAddressKind.LEGAL)
    ) {
      addresses = [
        ...addresses,
        ...parent!.addresses.filter((a) => a.kind === OrgAddressKind.LEGAL),
      ];
      inherited.legalAddress = true;
    }

    const contactDtos = contacts
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        id: c.id,
        kind: c.kind,
        value: c.value,
        label: c.label,
        purpose: c.purpose,
        isPrimary: c.isPrimary,
        sortOrder: c.sortOrder,
      }));

    const addressDtos = addresses
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((a) => ({
        id: a.id,
        kind: a.kind,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        region: a.region,
        postalCode: a.postalCode,
        country: a.country,
        lineAz: a.lineAz,
        lineRu: a.lineRu,
        lineEn: a.lineEn,
        isPrimary: a.isPrimary,
        sortOrder: a.sortOrder,
      }));

    const phone =
      contactDtos.find((c) => c.kind === "PHONE" && c.isPrimary)?.value ||
      contactDtos.find((c) => c.kind === "MOBILE" && c.isPrimary)?.value ||
      contactDtos.find((c) => c.kind === "PHONE")?.value ||
      contactDtos.find((c) => c.kind === "MOBILE")?.value ||
      "";
    const email =
      contactDtos.find((c) => c.kind === "EMAIL" && c.isPrimary)?.value ||
      contactDtos.find((c) => c.kind === "EMAIL")?.value ||
      "";
    const website =
      contactDtos.find((c) => c.kind === "WEBSITE" && c.isPrimary)?.value ||
      contactDtos.find((c) => c.kind === "WEBSITE")?.value ||
      "";

    const legalAddr =
      addressDtos.find((a) => a.kind === "LEGAL" && a.isPrimary) ||
      addressDtos.find((a) => a.kind === "LEGAL") ||
      addressDtos.find((a) => a.isPrimary) ||
      addressDtos[0];
    const legalAddress = legalAddr
      ? [legalAddr.line1, legalAddr.line2, legalAddr.city, legalAddr.region]
          .map((x) => x?.trim())
          .filter(Boolean)
          .join(", ")
      : "";

    const print = {
      "org.name": (tradeName || legalName).trim(),
      "org.taxId": taxId,
      "org.legalAddress": legalAddress,
      "org.logoUrl": logoUrl ?? "",
      "org.bankLine": bankLine ?? "",
      "org.phone": phone,
      "org.email": email,
      "org.website": website,
    };

    const updatedAt = (own?.updatedAt ?? new Date()).toISOString();
    const etag = createHash("sha256")
      .update(JSON.stringify({ print, contactDtos, addressDtos, updatedAt }))
      .digest("hex")
      .slice(0, 16);

    return {
      organizationId: org.id,
      parentOrganizationId: org.parentOrgId,
      operatingMode: org.operatingMode,
      legalName,
      tradeName,
      nameAz,
      nameRu,
      nameEn,
      taxId: taxId || null,
      currency: org.currency || "AZN",
      directorName: own?.directorName ?? parent?.directorName ?? null,
      directorTitle: own?.directorTitle ?? parent?.directorTitle ?? null,
      logoUrl,
      stampUrl: own?.stampUrl ?? null,
      signatureDirectorUrl: own?.signatureDirectorUrl ?? null,
      bankLine,
      contacts: contactDtos,
      addresses: addressDtos,
      print,
      inheritedFromParent:
        Object.keys(inherited).length > 0 ? inherited : undefined,
      updatedAt,
      etag,
    };
  }
}
