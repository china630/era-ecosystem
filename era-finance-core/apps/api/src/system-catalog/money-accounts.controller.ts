import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { LedgerType } from "@erafinance/database";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrganizationId } from "../common/org-id.decorator";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { PrismaService } from "../prisma/prisma.service";

function matchesMoneyPrefix(code: string, root: string): boolean {
  return code === root || code.startsWith(`${root}.`);
}

@Controller("system")
@ApiTags("system")
@ApiBearerAuth("bearer")
@UseGuards(RolesGuard)
export class MoneyAccountsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: PostingAccountResolver,
  ) {}

  @Get("money-accounts")
  @ApiOperation({
    summary: "Incoming payment debit accounts (cash/bank) for active organization",
  })
  async listMoneyAccounts(
    @OrganizationId() organizationId: string,
    @Query("purpose") purpose = "incoming",
  ) {
    if (purpose !== "incoming") {
      return { options: [] as unknown[] };
    }
    const [cashAzn, cashForeign, mainBank] = await Promise.all([
      this.posting.resolveAccountCode(organizationId, "CASH_AZN"),
      this.posting.resolveAccountCode(organizationId, "CASH_FOREIGN"),
      this.posting.resolveAccountCode(organizationId, "MAIN_BANK"),
    ]);
    const roots = [
      { root: cashAzn, kind: "CASH" as const, currency: "AZN" },
      { root: cashForeign, kind: "CASH" as const, currency: null },
      { root: mainBank, kind: "BANK" as const, currency: null },
    ];
    const accounts = await this.prisma.account.findMany({
      where: { organizationId, ledgerType: LedgerType.NAS },
      orderBy: { code: "asc" },
      select: { code: true, nameAz: true, nameRu: true, currency: true },
    });
    const options: Array<{
      code: string;
      label: string;
      kind: "CASH" | "BANK";
      currency: string;
      requiresBankAccountId?: boolean;
    }> = [];
    for (const acc of accounts) {
      const meta = roots.find((r) => matchesMoneyPrefix(acc.code, r.root));
      if (!meta) continue;
      const label = acc.nameAz || acc.nameRu || acc.code;
      const currency =
        meta.kind === "CASH" && meta.root === cashAzn
          ? "AZN"
          : (acc.currency?.trim().toUpperCase() || "AZN");
      options.push({
        code: acc.code,
        label: `${acc.code} — ${label}`,
        kind: meta.kind,
        currency,
        ...(meta.kind === "BANK" ? { requiresBankAccountId: true } : {}),
      });
    }
    return { options };
  }
}
