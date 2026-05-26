import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LedgerType,
  OrganizationKind,
  POSTING_ROLES,
  assertPostingRole,
  loadPostingRolesJson,
  type PostingRole,
  type UserRole,
} from "@erafinance/database";
import { PrismaService } from "../../prisma/prisma.service";
import { assertBudgetPostingRoleOverrideSafe } from "./posting-kind-guard";

const MUTATE_ROLES = new Set<UserRole>(["OWNER", "ADMIN", "ACCOUNTANT"]);

@Injectable()
export class PostingRolesService {
  constructor(private readonly prisma: PrismaService) {}

  assertMayMutate(role: UserRole): void {
    if (!MUTATE_ROLES.has(role)) {
      throw new BadRequestException("Only OWNER, ADMIN, or ACCOUNTANT may edit posting roles");
    }
  }

  async listForOrganization(organizationId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { kind: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const templateRows = await this.prisma.templatePostingRole.findMany({
      where: { kind: org.kind },
      orderBy: { role: "asc" },
    });
    const templateMap =
      templateRows.length > 0
        ? new Map(templateRows.map((r) => [r.role, r.accountCode]))
        : new Map(
            Object.entries(await loadPostingRolesJson(org.kind)).map(([k, v]) => [k, v]),
          );

    const overrides = await this.prisma.organizationPostingRole.findMany({
      where: { organizationId },
    });
    const overrideMap = new Map(overrides.map((o) => [o.role, o]));

    return POSTING_ROLES.map((role) => {
      const override = overrideMap.get(role);
      const templateCode = templateMap.get(role) ?? null;
      return {
        role,
        templateAccountCode: templateCode,
        accountCode: override?.accountCode ?? templateCode,
        isOverride: !!override,
        overrideId: override?.id ?? null,
      };
    });
  }

  async patchRole(
    organizationId: string,
    roleRaw: string,
    accountCode: string,
    userRole: UserRole,
  ) {
    this.assertMayMutate(userRole);
    const role = assertPostingRole(roleRaw);
    const code = accountCode.trim();
    if (!code) throw new BadRequestException("accountCode required");

    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { kind: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    assertBudgetPostingRoleOverrideSafe(org.kind, role, code);

    const acc = await this.prisma.account.findFirst({
      where: {
        organizationId,
        ledgerType: LedgerType.NAS,
        code,
        deletedAt: null,
      },
    });
    if (!acc) {
      throw new BadRequestException(
        `Account ${code} does not exist in organization NAS chart`,
      );
    }

    const row = await this.prisma.organizationPostingRole.upsert({
      where: { organizationId_role: { organizationId, role } },
      create: { organizationId, role, accountCode: code },
      update: { accountCode: code },
    });
    return row;
  }

  async clearOverride(organizationId: string, roleRaw: string, userRole: UserRole) {
    this.assertMayMutate(userRole);
    const role = assertPostingRole(roleRaw);
    await this.prisma.organizationPostingRole.deleteMany({
      where: { organizationId, role },
    });
    return { role, cleared: true };
  }
}
