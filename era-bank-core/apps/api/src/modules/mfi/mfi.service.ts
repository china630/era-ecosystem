import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BorrowerGroupStatus,
  CollectionSheetStatus,
  GroupMemberRole,
  LoanLiabilityType,
  ProductKind,
  Prisma,
} from "@era/bank-core-database";
import { PrismaService } from "../../prisma/prisma.service";
import { BankOrgConfig } from "../../common/bank-org.config";
import { LoansService } from "../loans/loans.service";
import { validateGroupMembershipBatch } from "./mfi-group.util";
import { computeDaysPastDue } from "../loans/loan-risk.util";

@Injectable()
export class MfiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bankOrg: BankOrgConfig,
    private readonly loans: LoansService,
  ) {}

  listGroups() {
    return this.prisma.borrowerGroup.findMany({
      where: { bankOrgId: this.bankOrg.bankOrgId },
      include: { memberships: true },
      orderBy: { createdAt: "desc" },
    });
  }

  getGroup(id: string) {
    return this.prisma.borrowerGroup.findFirst({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      include: { memberships: true, loans: { take: 50 } },
    });
  }

  createGroup(input: {
    name: string;
    liabilityType?: LoanLiabilityType;
    officerId?: string;
  }) {
    return this.prisma.borrowerGroup.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        name: input.name.trim(),
        officerId: input.officerId?.trim() || null,
        liabilityType: input.liabilityType ?? LoanLiabilityType.JLG,
        status: BorrowerGroupStatus.DRAFT,
      },
    });
  }

  async addMember(input: {
    groupId: string;
    customerId: string;
    role?: GroupMemberRole;
  }) {
    const group = await this.prisma.borrowerGroup.findFirst({
      where: { id: input.groupId, bankOrgId: this.bankOrg.bankOrgId },
      include: { memberships: true },
    });
    if (!group) throw new NotFoundException("Borrower group not found");
    if (group.status === BorrowerGroupStatus.CLOSED) {
      throw new BadRequestException("Cannot add members to a closed group");
    }
    const role = input.role ?? GroupMemberRole.MEMBER;
    if (group.memberships.some((m) => m.customerId === input.customerId)) {
      throw new BadRequestException("Customer is already in this group");
    }
    if (group.memberships.length >= 30) {
      throw new BadRequestException("Group cannot exceed 30 members");
    }
    if (
      role === GroupMemberRole.LEADER &&
      group.memberships.some((m) => m.role === GroupMemberRole.LEADER)
    ) {
      throw new BadRequestException("Group already has a leader");
    }
    return this.prisma.groupMembership.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        groupId: group.id,
        customerId: input.customerId,
        role,
      },
    });
  }

  async activateGroup(groupId: string) {
    const group = await this.prisma.borrowerGroup.findFirst({
      where: { id: groupId, bankOrgId: this.bankOrg.bankOrgId },
      include: { memberships: true },
    });
    if (!group) throw new NotFoundException("Borrower group not found");
    try {
      validateGroupMembershipBatch(
        group.memberships.map((m) => ({
          customerId: m.customerId,
          role: m.role,
        })),
      );
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : "Group not ready",
      );
    }
    return this.prisma.borrowerGroup.update({
      where: { id: group.id },
      data: { status: BorrowerGroupStatus.ACTIVE },
      include: { memberships: true },
    });
  }

  /**
   * JLG batch stub: originate one LOAN_MFI per active member with shared groupId.
   */
  async originateJlgBatch(input: {
    groupId: string;
    productTemplateId: string;
    principalMinorPerMember: string;
    termMonths?: number;
    rateAnnual?: number;
    makerUserId?: string;
  }) {
    const group = await this.prisma.borrowerGroup.findFirst({
      where: { id: input.groupId, bankOrgId: this.bankOrg.bankOrgId },
      include: { memberships: true },
    });
    if (!group) throw new NotFoundException("Borrower group not found");
    if (group.status !== BorrowerGroupStatus.ACTIVE) {
      throw new BadRequestException("Group must be ACTIVE before batch origination");
    }
    const template = await this.prisma.productTemplate.findFirst({
      where: {
        id: input.productTemplateId,
        bankOrgId: this.bankOrg.bankOrgId,
        kind: ProductKind.LOAN_MFI,
      },
    });
    if (!template) {
      throw new BadRequestException(
        "productTemplateId must be an active LOAN_MFI template",
      );
    }
    const principalMinor = BigInt(input.principalMinorPerMember);
    if (principalMinor <= 0n) {
      throw new BadRequestException("principalMinorPerMember must be positive");
    }
    const loans: Awaited<ReturnType<LoansService["originate"]>>[] = [];
    for (const member of group.memberships) {
      const loan = await this.loans.originate({
        customerId: member.customerId,
        productTemplateId: input.productTemplateId,
        principalMinor,
        termMonths: input.termMonths,
        rateAnnual: input.rateAnnual,
        groupId: group.id,
        liabilityType: group.liabilityType,
        makerUserId: input.makerUserId,
      });
      loans.push(loan);
    }
    return { groupId: group.id, liabilityType: group.liabilityType, loans };
  }

  async createCollectionSheet(input: {
    groupId: string;
    meetingDate: Date;
    lines?: Array<{
      customerId: string;
      loanId?: string;
      amountDueMinor: string;
    }>;
  }) {
    const group = await this.prisma.borrowerGroup.findFirst({
      where: { id: input.groupId, bankOrgId: this.bankOrg.bankOrgId },
      include: { memberships: true, loans: true },
    });
    if (!group) throw new NotFoundException("Borrower group not found");
    if (group.status !== BorrowerGroupStatus.ACTIVE) {
      throw new BadRequestException("Group must be ACTIVE");
    }
    let lines = input.lines;
    if (!lines?.length) {
      lines = group.loans
        .filter((l) => l.outstandingMinor > 0n)
        .map((l) => ({
          customerId: l.customerId,
          loanId: l.id,
          amountDueMinor: l.outstandingMinor.toString(),
        }));
    }
    return this.prisma.collectionSheet.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        groupId: group.id,
        meetingDate: input.meetingDate,
        status: CollectionSheetStatus.OPEN,
        linesJson: lines as Prisma.InputJsonValue,
      },
    });
  }

  listCollectionSheets(groupId: string) {
    return this.prisma.collectionSheet.findMany({
      where: { groupId, bankOrgId: this.bankOrg.bankOrgId },
      orderBy: { meetingDate: "desc" },
    });
  }

  /**
   * Batch collect: repay linked loans; mark COLLECTED only when every
   * positive-amount line succeeds. Idempotency key is sheet+loan (not amount).
   */
  async collectSheet(
    sheetId: string,
    input: {
      lines: Array<{
        customerId: string;
        loanId?: string;
        amountCollectedMinor: string;
      }>;
      makerUserId?: string;
    },
  ) {
    const sheet = await this.prisma.collectionSheet.findFirst({
      where: { id: sheetId, bankOrgId: this.bankOrg.bankOrgId },
    });
    if (!sheet) throw new NotFoundException("Collection sheet not found");
    if (sheet.status !== CollectionSheetStatus.OPEN) {
      throw new BadRequestException("Sheet is not OPEN");
    }
    const priorLines = Array.isArray(sheet.linesJson)
      ? (sheet.linesJson as Array<Record<string, unknown>>)
      : [];
    const dueByKey = new Map(
      priorLines.map((l) => [
        `${String(l.customerId ?? "")}:${String(l.loanId ?? "")}`,
        String(l.amountDueMinor ?? "0"),
      ]),
    );
    const results: Array<{ loanId?: string; repaid?: string; error?: string }> =
      [];
    const mergedLines: Array<Record<string, string>> = [];
    let attemptCount = 0;
    let errorCount = 0;
    for (const line of input.lines) {
      const amount = BigInt(line.amountCollectedMinor || "0");
      const key = `${line.customerId}:${line.loanId ?? ""}`;
      mergedLines.push({
        customerId: line.customerId,
        loanId: line.loanId ?? "",
        amountDueMinor: dueByKey.get(key) ?? "0",
        amountCollectedMinor: amount.toString(),
      });
      if (amount <= 0n || !line.loanId) {
        results.push({ loanId: line.loanId, repaid: "0" });
        continue;
      }
      attemptCount += 1;
      try {
        // Key omits amount so retries with the same sheet+loan stay idempotent.
        await this.loans.repay(
          line.loanId,
          amount,
          input.makerUserId ?? "mfi-officer",
          `mfi-sheet-${sheetId}-${line.loanId}`,
        );
        results.push({ loanId: line.loanId, repaid: amount.toString() });
      } catch (e) {
        errorCount += 1;
        results.push({
          loanId: line.loanId,
          error: e instanceof Error ? e.message : "repay failed",
        });
      }
    }
    const allOk = errorCount === 0 && (attemptCount > 0 || input.lines.length === 0);
    const updated = await this.prisma.collectionSheet.update({
      where: { id: sheet.id },
      data: {
        status: allOk
          ? CollectionSheetStatus.COLLECTED
          : CollectionSheetStatus.OPEN,
        linesJson: mergedLines as Prisma.InputJsonValue,
      },
    });
    if (!allOk) {
      throw new BadRequestException({
        message:
          "Collection sheet left OPEN — one or more repayments failed; retry after fix",
        sheetId: sheet.id,
        results,
      });
    }
    return { sheet: updated, results };
  }

  /** PAR30 by officer — loans with DPD ≥ 30 under groups of that officer. */
  async par30ByOfficer(officerId?: string) {
    const groups = await this.prisma.borrowerGroup.findMany({
      where: {
        bankOrgId: this.bankOrg.bankOrgId,
        ...(officerId ? { officerId } : { officerId: { not: null } }),
      },
      include: {
        loans: {
          include: {
            installments: { select: { dueDate: true, status: true } },
          },
        },
      },
    });
    const byOfficer = new Map<
      string,
      { officerId: string; loanCount: number; par30Count: number; outstandingPar30Minor: string }
    >();
    for (const g of groups) {
      const oid = g.officerId ?? "unassigned";
      let row = byOfficer.get(oid);
      if (!row) {
        row = {
          officerId: oid,
          loanCount: 0,
          par30Count: 0,
          outstandingPar30Minor: "0",
        };
        byOfficer.set(oid, row);
      }
      for (const loan of g.loans) {
        row.loanCount += 1;
        const dpd = computeDaysPastDue(
          loan.installments.map((i) => ({
            dueDate: i.dueDate,
            status: i.status,
          })),
        );
        if (dpd >= 30) {
          row.par30Count += 1;
          row.outstandingPar30Minor = (
            BigInt(row.outstandingPar30Minor) + loan.outstandingMinor
          ).toString();
        }
      }
    }
    return {
      methodology: "lab",
      officers: [...byOfficer.values()],
    };
  }
}