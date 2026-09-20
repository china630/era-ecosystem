import { Injectable, Logger } from "@nestjs/common";
import {
  OrganizationKind,
  organizationKindToPayrollSettingsTemplateGroup,
} from "@erafinance/database";
import { ControlPlaneClient } from "../control-plane/control-plane.client";
import { OrgStructureService } from "../hr/org-structure.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { PrismaService } from "../prisma/prisma.service";
import { PiiCryptoService } from "../security/pii-crypto.service";
import { DEFAULT_NEW_ORGANIZATION_ACTIVE_MODULES } from "../subscription/subscription.constants";
import { resolveNewOrganizationTrialSubscription } from "../subscription/trial-package.util";

/**
 * Ensures a Finance `Organization` row exists with the same UUID as the control-plane
 * tenant before workforce event consumers insert Department / JobPosition / Employee.
 * Mirrors the SSO path in AuthService.resolveOrProvisionControlPlaneOrg without
 * requiring a user login first (Evrostar wave 0 dual-VÖEN hire).
 */
@Injectable()
export class WorkforceOrgEnsureService {
  private readonly logger = new Logger(WorkforceOrgEnsureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly controlPlane: ControlPlaneClient,
    private readonly piiCrypto: PiiCryptoService,
    private readonly organizations: OrganizationsService,
    private readonly orgStructure: OrgStructureService,
  ) {}

  async ensureOrganization(organizationId: string): Promise<void> {
    const existing = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (existing) return;

    const details =
      await this.controlPlane.fetchOrganizationDetails(organizationId);
    const orgName =
      details?.name?.trim() || `Organization ${organizationId.slice(0, 8)}`;
    const normalizedTaxId = details?.taxId?.trim() || null;
    let taxIdBlindIndex: string | null = null;
    let taxIdCipher: string | null = null;
    if (normalizedTaxId) {
      try {
        taxIdBlindIndex = this.piiCrypto.blindIndexForVoen(normalizedTaxId);
        taxIdCipher = this.piiCrypto.encryptVoen(normalizedTaxId);
      } catch (e) {
        this.logger.warn(
          `Workforce org ensure: PII keys missing for ${organizationId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    if (taxIdBlindIndex) {
      const byVoen = await this.prisma.organization.findFirst({
        where: { taxIdBlindIndex },
        select: { id: true },
      });
      if (byVoen && byVoen.id !== organizationId) {
        // Fail-visible: silent return left hire/org-unit with FK errors and
        // buried the dual-VÖEN UUID mismatch. Operator must realign Finance
        // org id to control-plane UUID (or merge tenants) before import.
        this.logger.error(
          `Workforce org ensure: VÖEN already mapped to Finance org ${byVoen.id}; expected CP id ${organizationId}`,
        );
        throw new Error(
          `Finance Organization UUID mismatch for VÖEN: have ${byVoen.id}, need control-plane ${organizationId}`,
        );
      }
      if (byVoen?.id === organizationId) return;
    }

    const currency = await this.ensureDefaultCurrencyCode();
    const kind = OrganizationKind.COMMERCIAL;

    let createdId: string;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const o = await tx.organization.create({
          data: {
            id: organizationId,
            name: orgName,
            taxIdBlindIndex,
            taxIdCipher,
            currency,
            subscriptionPlan: "mvp",
            activeModules: [...DEFAULT_NEW_ORGANIZATION_ACTIVE_MODULES],
            kind,
            settings: {
              templateGroup:
                organizationKindToPayrollSettingsTemplateGroup(kind),
            },
          },
        });
        const trial = await resolveNewOrganizationTrialSubscription(
          tx,
          o.createdAt,
        );
        await tx.organization.update({
          where: { id: o.id },
          data: { activeModules: trial.activeModules },
        });
        return o;
      });
      createdId = created.id;
    } catch (e) {
      const raced = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (raced) return;
      throw e;
    }

    this.logger.log(
      `Provisioned Finance Organization ${createdId} from workforce event (no SSO yet)`,
    );

    try {
      await this.prisma.$transaction((tx) =>
        this.organizations.provisionChartOfAccountsFromTemplate(
          tx,
          createdId,
          kind,
        ),
      );
      await this.orgStructure.ensureDefaultDepartmentAndPosition(createdId);
    } catch (e) {
      this.logger.warn(
        `Workforce org ensure: partial CoA/HQ for ${createdId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  private async ensureDefaultCurrencyCode(): Promise<string> {
    const azn = await this.prisma.currency.findUnique({
      where: { code: "AZN" },
      select: { code: true },
    });
    if (azn) return azn.code;
    const any = await this.prisma.currency.findFirst({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { code: true },
    });
    if (any) return any.code;
    await this.prisma.currency.create({
      data: {
        code: "AZN",
        symbol: "₼",
        decimals: 2,
        nameAz: "Azərbaycan manatı",
        nameRu: "Азербайджанский манат",
        nameEn: "Azerbaijani manat",
        sortOrder: 0,
        isActive: true,
      },
    });
    return "AZN";
  }
}
