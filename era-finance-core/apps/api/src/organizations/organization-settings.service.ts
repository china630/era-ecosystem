import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import { serializeForAudit } from "../audit/audit-serialize";
import { GlobalCompanyDirectoryService } from "../global-directory/global-company-directory.service";
import { PrismaService } from "../prisma/prisma.service";
import { mergeLockedPeriodUntil } from "../reporting/reporting-period.util";
import type { PatchOrganizationSettingsDto } from "./dto/patch-organization-settings.dto";
import { InventoryValuationMethod } from "@erafinance/database";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { FactQueueService } from "../reporting/fact-queue.service";
import { SchemePeriodService } from "../reporting/scheme-period.service";
import { decodeOrganizationTaxId } from "../security/pii-crypto.util";
import {
  mergeNetworkDocumentsSettings,
  parseNetworkDocumentsSettings,
} from "../network/network-settings.util";
import type { PatchNetworkDocumentsSettingsDto } from "../network/dto/patch-network-documents-settings.dto";

@Injectable()
export class OrganizationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: GlobalCompanyDirectoryService,
    private readonly posting: PostingAccountResolver,
    private readonly factQueue: FactQueueService,
    private readonly schemePeriod: SchemePeriodService,
  ) {}

  private async getSettingsRaw(organizationId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, isDeleted: false },
      include: { bankAccountsOrg: { orderBy: { createdAt: "asc" } } },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    return org;
  }

  async getSettings(organizationId: string) {
    const org = await this.getSettingsRaw(organizationId);
    // Express JSON can't serialize BigInt (e.g. storageUsedBytes).
    // Reuse common serializer used by audit payloads.
    return serializeForAudit(org);
  }

  async patchSettings(organizationId: string, dto: PatchOrganizationSettingsDto) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, isDeleted: false },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    // CP-ORG-PROFILE-01 Track A: legal branding SoR moved to orchestrator OrgOwner card.
    const moved: string[] = [];
    if (dto.legalAddress !== undefined) moved.push("legalAddress");
    if (dto.phone !== undefined) moved.push("phone");
    if (dto.directorName !== undefined) moved.push("directorName");
    if (dto.logoUrl !== undefined) moved.push("logoUrl");
    if (moved.length) {
      throw new BadRequestException({
        code: "ORG_PROFILE_MOVED_TO_CONTROL_PLANE",
        message:
          "Legal address, phone, director, and logo are edited in ERA Workspace → Organization profile",
        fields: moved,
      });
    }

    if (dto.lockedPeriodUntil) {
      await this.assertFactQueueForLock(organizationId, dto.lockedPeriodUntil);
      await this.assertAmendmentForLock(organizationId, dto.lockedPeriodUntil);
    }

    const valuation =
      dto.inventoryValuation ?? dto.valuationMethod ?? undefined;
    const baseSettings =
      org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};

    let mergedSettings: Record<string, unknown> | undefined;
    if (
      valuation !== undefined ||
      dto.asanUserId !== undefined ||
      dto.taxRegime !== undefined ||
      dto.pricesIncludeTax !== undefined ||
      dto.requireEqaimeForDayClose !== undefined ||
      dto.taxLookupMock !== undefined ||
      dto.signatureGatewayMock !== undefined ||
      dto.ledgerMirrorMode !== undefined ||
      dto.emasMode !== undefined ||
      dto.internalRateVisibleToHrManager !== undefined
    ) {
      mergedSettings = { ...baseSettings };
      if (valuation !== undefined) {
        mergedSettings.inventory = {
          ...(baseSettings.inventory &&
          typeof baseSettings.inventory === "object" &&
          !Array.isArray(baseSettings.inventory)
            ? (baseSettings.inventory as Record<string, unknown>)
            : {}),
          inventoryValuation: valuation,
        };
      }
      if (
        dto.asanUserId !== undefined ||
        dto.taxRegime !== undefined ||
        dto.pricesIncludeTax !== undefined ||
        dto.requireEqaimeForDayClose !== undefined ||
        dto.taxLookupMock !== undefined ||
        dto.signatureGatewayMock !== undefined
      ) {
        const prevTax =
          baseSettings.tax &&
          typeof baseSettings.tax === "object" &&
          !Array.isArray(baseSettings.tax)
            ? (baseSettings.tax as Record<string, unknown>)
            : {};
        const trimmed = dto.asanUserId?.trim() || null;
        mergedSettings.tax = {
          ...prevTax,
          ...(dto.asanUserId !== undefined ? { asanUserId: trimmed } : {}),
          ...(dto.taxRegime !== undefined ? { regime: dto.taxRegime } : {}),
          ...(dto.pricesIncludeTax !== undefined
            ? { pricesIncludeTax: dto.pricesIncludeTax }
            : {}),
          ...(dto.requireEqaimeForDayClose !== undefined
            ? { requireEqaimeForDayClose: dto.requireEqaimeForDayClose }
            : {}),
          ...(dto.taxLookupMock !== undefined
            ? { taxLookupMock: dto.taxLookupMock }
            : {}),
          ...(dto.signatureGatewayMock !== undefined
            ? { signatureGatewayMock: dto.signatureGatewayMock }
            : {}),
        };
      }
      if (dto.ledgerMirrorMode !== undefined) {
        const prevLm =
          baseSettings.ledgerMirror &&
          typeof baseSettings.ledgerMirror === "object" &&
          !Array.isArray(baseSettings.ledgerMirror)
            ? (baseSettings.ledgerMirror as Record<string, unknown>)
            : {};
        mergedSettings.ledgerMirror = {
          ...prevLm,
          mode: dto.ledgerMirrorMode,
          mappingSetCode: prevLm.mappingSetCode ?? "NAS_TO_IFRS",
        };
      }
      if (dto.emasMode !== undefined || dto.internalRateVisibleToHrManager !== undefined) {
        const prevHr =
          baseSettings.hr &&
          typeof baseSettings.hr === "object" &&
          !Array.isArray(baseSettings.hr)
            ? (baseSettings.hr as Record<string, unknown>)
            : {};
        mergedSettings.hr = {
          ...prevHr,
          ...(dto.emasMode !== undefined ? { emasMode: dto.emasMode } : {}),
          ...(dto.internalRateVisibleToHrManager !== undefined
            ? {
                internalRateVisibleToHrManager:
                  dto.internalRateVisibleToHrManager,
              }
            : {}),
        };
      }
    }
    const nextSettings =
      mergedSettings !== undefined
        ? (mergedSettings as Prisma.InputJsonValue)
        : undefined;

    const defaultBankLedger =
      dto.bankAccounts !== undefined && dto.bankAccounts.length > 0
        ? await this.posting.resolveAccountCode(organizationId, "MAIN_BANK")
        : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(valuation !== undefined && {
            valuationMethod: valuation as InventoryValuationMethod,
          }),
          ...(nextSettings !== undefined && {
            settings: nextSettings,
          }),
          ...(dto.lockedPeriodUntil !== undefined && {
            settings: mergeLockedPeriodUntil(
              nextSettings ?? org.settings,
              dto.lockedPeriodUntil ? dto.lockedPeriodUntil.trim() : null,
              dto.ledgerType === "IFRS" ? "IFRS" : "NAS",
            ) as Prisma.InputJsonValue,
          }),
        },
      });

      if (dto.bankAccounts !== undefined) {
        await tx.organizationBankAccount.deleteMany({
          where: { organizationId },
        });
        if (dto.bankAccounts.length > 0) {
          await tx.organizationBankAccount.createMany({
            data: dto.bankAccounts.map((b) => ({
              organizationId,
              bankName: b.bankName.trim(),
              accountNumber: b.accountNumber?.trim() || b.iban?.trim() || null,
              currency: (b.currency?.trim().toUpperCase() || "AZN"),
              iban: b.iban?.trim() || b.accountNumber?.trim() || "",
              swift: b.swift?.trim() || null,
              ledgerAccountCode:
                b.ledgerAccountCode?.trim() || defaultBankLedger!,
              accountType: (b.accountType as any) || "MAIN",
              isPrimary: b.isPrimary === true,
              isFrozen: b.isFrozen === true,
              isArchived: b.isArchived === true,
            })),
          });
        }
      }
    });

    const fresh = await this.getSettingsRaw(organizationId);
    this.directory.scheduleUpsert({
      taxId: decodeOrganizationTaxId(fresh),
      name: fresh.name,
      legalAddress: fresh.legalAddress,
      phone: fresh.phone,
      directorName: fresh.directorName,
    });
    return serializeForAudit(fresh);
  }

  private async assertFactQueueForLock(
    organizationId: string,
    lockedPeriodUntil: string | null,
  ): Promise<void> {
    const trimmed = lockedPeriodUntil?.trim() ?? "";
    const match = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(trimmed);
    if (!match) return;
    await this.factQueue.assertEmptyForClose(
      organizationId,
      Number(match[1]),
      Number(match[2]),
    );
  }

  private async assertAmendmentForLock(
    organizationId: string,
    lockedPeriodUntil: string | null,
  ): Promise<void> {
    const trimmed = lockedPeriodUntil?.trim() ?? "";
    const match = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(trimmed);
    if (!match) return;
    await this.schemePeriod.assertCloseAllowed(organizationId, `${match[1]}-${match[2]}`);
  }

  async patchNetworkDocumentsSettings(
    organizationId: string,
    dto: PatchNetworkDocumentsSettingsDto,
  ) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, isDeleted: false },
      select: { id: true, settings: true },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    const merged = mergeNetworkDocumentsSettings(org.settings, {
      acceptInbound: dto.acceptInbound,
      autoPostSafeRoles: dto.autoPostSafeRoles,
    });
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: merged as Prisma.InputJsonValue },
    });
    return {
      networkDocuments: parseNetworkDocumentsSettings(merged),
    };
  }

  async patchPeriodLock(
    organizationId: string,
    lockedPeriodUntil: string | null,
    ledgerType: "NAS" | "IFRS" | "MANAGEMENT" = "NAS",
    accountingBookId?: string,
  ) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, isDeleted: false },
      select: { id: true, settings: true },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    if (accountingBookId) {
      const book = await this.prisma.accountingBook.findFirst({
        where: {
          id: accountingBookId,
          organizationId,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!book) {
        throw new BadRequestException("Active accounting book not found");
      }
    }
    await this.assertFactQueueForLock(organizationId, lockedPeriodUntil);
    await this.assertAmendmentForLock(organizationId, lockedPeriodUntil);
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: mergeLockedPeriodUntil(
          org.settings,
          lockedPeriodUntil ? lockedPeriodUntil.trim() : null,
          ledgerType,
          accountingBookId,
        ) as Prisma.InputJsonValue,
      },
    });
    const fresh = await this.getSettingsRaw(organizationId);
    return serializeForAudit(fresh);
  }

  async uploadLogo(_organizationId: string, _file: Express.Multer.File | undefined) {
    throw new BadRequestException({
      code: "ORG_PROFILE_MOVED_TO_CONTROL_PLANE",
      message:
        "Organization logo is uploaded in ERA Workspace → Organization profile",
      fields: ["logoUrl"],
    });
  }
}
