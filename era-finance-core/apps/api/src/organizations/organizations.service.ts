import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OrganizationKind,
  UserRole,
  provisionNasAccountsForOrganization,
  upsertGlobalPostingRoleTemplates,
  type Prisma,
} from "@erafinance/database";
import {
  normalizeChartAccountSeedRow,
  type ChartJsonRemoteLoader,
} from "@erafinance/database";
import { AccountsService } from "../accounts/accounts.service";
import { DataHubClientService } from "../data-hub/data-hub-client.service";
import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../access/access-control.service";
import { OrchestratorHoldingsClientService } from "../orchestrator/orchestrator-holdings-client.service";
import { decodeOrganizationTaxId } from "../security/pii-crypto.util";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly accounts: AccountsService,
    private readonly dataHub: DataHubClientService,
    private readonly holdingsCp: OrchestratorHoldingsClientService,
  ) {}

  private chartRemoteLoader(): ChartJsonRemoteLoader | undefined {
    if (!this.dataHub.isEnabled()) return undefined;
    return async (kind) => {
      const body = await this.dataHub.getChartOfAccounts(kind.toLowerCase());
      if (!body?.accounts) return null;
      const raw = Array.isArray(body.accounts)
        ? body.accounts
        : (body.accounts as { accounts?: unknown[] }).accounts;
      if (!Array.isArray(raw) || raw.length === 0) return null;
      return (raw as Record<string, unknown>[]).map(normalizeChartAccountSeedRow);
    };
  }

  /**
   * Копирует глобальный NAS (`template_accounts`, иначе legacy `chart_of_accounts_entries`) в
   * `accounts` организации по профилю Small/Full, затем Multi-GAAP bootstrap. Вызывать в той же
   * `prisma.$transaction`, что и `organization.create`.
   */
  async provisionChartOfAccountsFromTemplate(
    tx: Prisma.TransactionClient,
    organizationId: string,
    kind: OrganizationKind = OrganizationKind.COMMERCIAL,
  ): Promise<void> {
    await provisionNasAccountsForOrganization(
      tx,
      organizationId,
      kind,
      this.chartRemoteLoader(),
    );
    await upsertGlobalPostingRoleTemplates(tx);
    await this.accounts.bootstrapMultiGaapForNewOrganization(organizationId, tx);
  }

  /**
   * Смена `organizations.ownerId`; прежний OWNER → ADMIN, новый пользователь → OWNER.
   */
  async transferOwnership(
    currentUserId: string,
    organizationId: string,
    newOwnerUserId: string,
  ): Promise<{ organizationId: string; ownerId: string }> {
    if (newOwnerUserId === currentUserId) {
      throw new BadRequestException("newOwnerUserId must differ from current user");
    }

    await this.access.assertCurrentUserIsOwner(currentUserId, organizationId);

    const newMembership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: newOwnerUserId,
          organizationId,
        },
      },
    });
    if (!newMembership) {
      throw new NotFoundException(
        "New owner must already be a member of this organization",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { ownerId: newOwnerUserId },
      });

      await tx.organizationMembership.update({
        where: {
          userId_organizationId: {
            userId: currentUserId,
            organizationId,
          },
        },
        data: { role: UserRole.ADMIN },
      });

      await tx.organizationMembership.update({
        where: {
          userId_organizationId: {
            userId: newOwnerUserId,
            organizationId,
          },
        },
        data: { role: UserRole.OWNER },
      });
    });

    return { organizationId, ownerId: newOwnerUserId };
  }

  async getOrganizationsTreeForUser(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            taxIdCipher: true,
            taxIdBlindIndex: true,
            currency: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const orgById = new Map(
      memberships.map((m) => [
        m.organization.id,
        {
          id: m.organization.id,
          name: m.organization.name,
          taxId: decodeOrganizationTaxId(m.organization),
          currency: m.organization.currency,
        },
      ]),
    );

    const cpHoldings = await this.holdingsCp.listHoldingsForUser(userId);
    const holdingOrgIds = new Set<string>();
    const holdings = cpHoldings.map((h) => {
      const organizations = h.organizationIds
        .map((id) => orgById.get(id))
        .filter((o): o is NonNullable<typeof o> => o != null);
      for (const o of organizations) holdingOrgIds.add(o.id);
      return {
        holdingId: h.id,
        holdingName: h.name,
        baseCurrency: (h.baseCurrency ?? "AZN").toUpperCase(),
        organizations,
      };
    });

    const freeOrganizations = [...orgById.values()]
      .filter((o) => !holdingOrgIds.has(o.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    holdings.sort((a, b) => a.holdingName.localeCompare(b.holdingName));

    return { holdings, freeOrganizations };
  }
}
