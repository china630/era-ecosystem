import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  AccountType,
  FixedAssetDepreciationMethod,
  InvoiceStatus,
  LedgerType,
  MigrationDraftKind,
  MigrationDraftStatus,
  Prisma,
  StockMovementReason,
  StockMovementType,
} from "@erafinance/database";
import { AccountingService, type PostTransactionLine } from "../accounting/accounting.service";
import { AccountingBookService } from "../accounting/accounting-book.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { PrismaService } from "../prisma/prisma.service";
import { WorkforceEmploymentSyncService } from "../integration/workforce-employment-sync.service";
import { ControlPlaneClient } from "../control-plane/control-plane.client";
import { blindIndex, normalizeVoen } from "../security/pii-crypto.util";
import { bakuDateKey, todayBakuYmd } from "@era/satellite-kit/time";
import { draftEnumToSlug } from "./migration-kinds";

const Decimal = Prisma.Decimal;
const OPENING_ACCOUNT_CODE = "000";

export type ValidationIssue = {
  severity: "red" | "yellow";
  code: string;
  message: string;
  kind?: string;
  row?: number;
};

@Injectable()
export class MigrationAssembleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly accountingBooks: AccountingBookService,
    private readonly posting: PostingAccountResolver,
    private readonly workforceHire: WorkforceEmploymentSyncService,
    private readonly controlPlane: ControlPlaneClient,
  ) {}

  async status(organizationId: string) {
    const org = await this.prisma.organization.findFirstOrThrow({
      where: { id: organizationId },
      select: {
        migrationCutoverDate: true,
        migrationAssembledAt: true,
        taxIdBlindIndex: true,
        name: true,
      },
    });
    const drafts = await this.prisma.migrationDraftBatch.findMany({
      where: { organizationId, status: MigrationDraftStatus.DRAFT },
      select: {
        id: true,
        kind: true,
        createdCount: true,
        errorCount: true,
        updatedAt: true,
      },
    });
    const logs = await this.prisma.migrationUploadLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const bankAccounts = await this.prisma.organizationBankAccount.count({
      where: { organizationId, isArchived: false },
    });
    const checklist = {
      hasTaxId: Boolean(org.taxIdBlindIndex),
      hasBankAccount: bankAccounts > 0,
      hasCutoverDate: Boolean(org.migrationCutoverDate),
      assembled: Boolean(org.migrationAssembledAt),
    };
    return {
      cutoverDate: org.migrationCutoverDate
        ? bakuDateKey(org.migrationCutoverDate)
        : null,
      assembledAt: org.migrationAssembledAt?.toISOString() ?? null,
      drafts: drafts.map((d) => ({
        ...d,
        kind: draftEnumToSlug(d.kind),
      })),
      logs,
      checklist,
    };
  }

  async setCutoverDate(organizationId: string, dateYmd: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
      throw new BadRequestException("cutoverDate must be YYYY-MM-DD");
    }
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { migrationAssembledAt: true },
    });
    if (org?.migrationAssembledAt) {
      throw new ConflictException("Cutover date is locked after assemble");
    }
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { migrationCutoverDate: new Date(`${dateYmd}T00:00:00.000Z`) },
    });
    return this.status(organizationId);
  }

  async pullWorkforce(organizationId: string): Promise<{
    pulled: number;
    errors: string[];
    skipped: number;
  }> {
    let employments: Array<Record<string, unknown>> = [];
    try {
      const res = await this.controlPlane.forward<{
        items?: Array<Record<string, unknown>>;
      }>({
        method: "GET",
        path: `/internal/v1/workforce/employments?organizationId=${encodeURIComponent(organizationId)}&status=ACTIVE`,
      });
      employments = Array.isArray(res) ? (res as unknown as Array<Record<string, unknown>>) : res.items ?? [];
    } catch (err) {
      throw new BadRequestException(
        `Could not list workforce employments: ${err instanceof Error ? err.message : "error"}`,
      );
    }

    let pulled = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const emp of employments) {
      const cpEmploymentId = String(emp.id ?? emp.cpEmploymentId ?? "");
      const globalPersonId = String(emp.globalPersonId ?? "");
      const positionId = String(emp.positionId ?? emp.cpPositionId ?? "");
      const hireDate = String(emp.hireDate ?? emp.startDate ?? todayBakuYmd()).slice(0, 10);
      const fullName = String(emp.fullName ?? emp.displayName ?? "Employee");
      if (!cpEmploymentId || !globalPersonId || !positionId) {
        errors.push(`${cpEmploymentId || "?"}: missing identity fields`);
        continue;
      }
      const existing = await this.prisma.employee.findFirst({
        where: { organizationId, cpEmploymentId, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      try {
        await this.workforceHire.handleHired(organizationId, {
          type: "WORKFORCE_EMPLOYMENT_HIRED",
          organizationId,
          occurredAt: new Date().toISOString(),
          globalPersonId,
          payload: {
            cpEmploymentId,
            organizationId,
            globalPersonId,
            orgUnitId: String(emp.orgUnitId ?? emp.unitId ?? positionId),
            positionId,
            hireDate,
            fullName,
          },
        });
        pulled += 1;
      } catch (err) {
        errors.push(
          `${cpEmploymentId}: ${err instanceof Error ? err.message : "failed"}`,
        );
      }
    }
    return { pulled, skipped, errors };
  }

  async validate(organizationId: string): Promise<{
    ok: boolean;
    issues: ValidationIssue[];
    trial000: string;
  }> {
    const issues: ValidationIssue[] = [];
    let trial000 = new Decimal(0);
    const org = await this.prisma.organization.findFirstOrThrow({
      where: { id: organizationId },
      select: {
        migrationCutoverDate: true,
        migrationAssembledAt: true,
        taxIdBlindIndex: true,
      },
    });

    if (org.migrationAssembledAt) {
      issues.push({
        severity: "red",
        code: "ALREADY_ASSEMBLED",
        message: "Migration already assembled",
      });
      return { ok: false, issues, trial000: "0.00" };
    }
    if (!org.migrationCutoverDate) {
      issues.push({
        severity: "red",
        code: "NO_CUTOVER",
        message: "Set cutover date before assemble",
      });
    }
    if (!org.taxIdBlindIndex) {
      issues.push({
        severity: "yellow",
        code: "NO_ORG_VOEN",
        message: "Organization VÖEN is empty",
      });
    }

    const cutover = org.migrationCutoverDate;
    if (cutover) {
      const afterDocs = await this.prisma.transaction.count({
        where: {
          organizationId,
          date: { gt: cutover },
          NOT: { reference: { startsWith: "OPENING-" } },
        },
      });
      if (afterDocs > 0) {
        issues.push({
          severity: "red",
          code: "DOCS_AFTER_CUTOVER",
          message: `Found ${afterDocs} transactions after cutover date`,
        });
      }
    }

    const drafts = await this.prisma.migrationDraftBatch.findMany({
      where: { organizationId, status: MigrationDraftStatus.DRAFT },
      include: { lines: true },
    });

    const openItemKeys = new Set<string>();

    for (const batch of drafts) {
      for (const line of batch.lines) {
        const kindSlug = draftEnumToSlug(batch.kind);
        if (line.error) {
          issues.push({
            severity: "red",
            code: "ROW_PARSE_ERROR",
            message: line.error,
            kind: kindSlug,
            row: line.rowNumber,
          });
          continue;
        }
        const payload = line.payload as Record<string, unknown>;
        await this.validateLine(
          organizationId,
          batch.kind,
          payload,
          issues,
          line.rowNumber,
          kindSlug,
        );

        if (batch.kind === MigrationDraftKind.OPEN_ITEMS) {
          const key = `${String(payload.side ?? "").toLowerCase()}|${String(payload.documentNumber ?? "")}`;
          if (openItemKeys.has(key)) {
            issues.push({
              severity: "red",
              code: "OPEN_ITEM_DUP",
              message: `Duplicate open item ${key}`,
              kind: kindSlug,
              row: line.rowNumber,
            });
          } else {
            openItemKeys.add(key);
          }
        }

        // VAT_REGISTER is Evidence-only — excluded from tech 000 trial
        if (
          batch.kind === MigrationDraftKind.CASH_BANK ||
          batch.kind === MigrationDraftKind.CAPITAL ||
          batch.kind === MigrationDraftKind.STOCK ||
          batch.kind === MigrationDraftKind.OPEN_ITEMS ||
          batch.kind === MigrationDraftKind.ADVANCES ||
          batch.kind === MigrationDraftKind.PAYROLL_LIABILITIES ||
          batch.kind === MigrationDraftKind.HR_BALANCES ||
          batch.kind === MigrationDraftKind.FIXED_ASSETS
        ) {
          const amount = Number(payload.amount ?? payload.salaryDebt ?? 0);
          const cost =
            batch.kind === MigrationDraftKind.STOCK
              ? Number(payload.quantity ?? 0) * Number(payload.costPrice ?? 0)
              : batch.kind === MigrationDraftKind.FIXED_ASSETS
                ? Number(payload.originalCost ?? 0) -
                  Number(payload.accumulatedDepreciation ?? 0)
                : amount;
          if (Number.isFinite(cost)) {
            const side = await this.openingSide(
              organizationId,
              String(
                payload.accountCode ??
                  (batch.kind === MigrationDraftKind.HR_BALANCES ? "521" : "000"),
              ),
            );
            if (side === "debit_target") trial000 = trial000.sub(cost);
            else trial000 = trial000.add(cost);
          }
        }
      }
    }

    if (!trial000.abs().lt(0.01) && drafts.length > 0) {
      issues.push({
        severity: "red",
        code: "TECH_000_IMBALANCE",
        message: `Technical account 000 would remain at ${trial000.toFixed(2)} AZN after assemble — add capital (or balancing) lines`,
      });
    }

    const products = await this.prisma.product.count({
      where: { organizationId, deletedAt: null, isService: false },
    });
    const stockDraft = drafts.find((d) => d.kind === MigrationDraftKind.STOCK);
    if (!stockDraft && products === 0) {
      issues.push({
        severity: "yellow",
        code: "EMPTY_STOCK",
        message: "No stock draft and no goods products",
      });
    }

    const red = issues.some((i) => i.severity === "red");
    return { ok: !red, issues, trial000: trial000.toFixed(2) };
  }

  private async openingSide(
    organizationId: string,
    accountCode: string,
  ): Promise<"debit_target" | "credit_target"> {
    const account = await this.prisma.account.findFirst({
      where: { organizationId, code: accountCode, ledgerType: LedgerType.NAS },
      select: { type: true },
    });
    if (!account) return "debit_target";
    if (
      account.type === AccountType.LIABILITY ||
      account.type === AccountType.EQUITY ||
      account.type === AccountType.REVENUE
    ) {
      return "credit_target";
    }
    return "debit_target";
  }

  private async validateLine(
    organizationId: string,
    kind: MigrationDraftKind,
    payload: Record<string, unknown>,
    issues: ValidationIssue[],
    row: number,
    kindSlug: string = draftEnumToSlug(kind),
  ) {
    const push = (code: string, message: string) =>
      issues.push({ severity: "red", code, message, kind: kindSlug, row });

    switch (kind) {
      case MigrationDraftKind.STOCK: {
        const sku = String(payload.sku ?? "");
        const warehouseCode = String(payload.warehouseCode ?? "");
        const product = await this.prisma.product.findFirst({
          where: { organizationId, sku, deletedAt: null },
        });
        if (!product) push("SKU_MISSING", `Product sku not found: ${sku}`);
        else if (product.isService) push("SERVICE_IN_STOCK", `Service sku in stock: ${sku}`);
        else if (!product.revenueAccountCode) {
          issues.push({
            severity: "yellow",
            code: "NO_REVENUE_ACCOUNT",
            message: `SKU ${sku} has empty revenueAccountCode`,
            kind: kindSlug,
            row,
          });
        }
        const wh = await this.prisma.warehouse.findFirst({
          where: { organizationId, code: warehouseCode, deletedAt: null },
        });
        if (!wh) push("WAREHOUSE_MISSING", `Warehouse code not found: ${warehouseCode}`);
        break;
      }
      case MigrationDraftKind.CASH_BANK: {
        const accountCode = String(payload.accountCode ?? "");
        const iban = String(payload.iban ?? "").trim();
        const acc = await this.prisma.account.findFirst({
          where: { organizationId, code: accountCode, ledgerType: LedgerType.NAS },
        });
        if (!acc) push("ACCOUNT_MISSING", `Account not found: ${accountCode}`);
        if (iban) {
          const bank = await this.prisma.organizationBankAccount.findFirst({
            where: { organizationId, iban },
          });
          if (!bank) push("IBAN_MISSING", `Org bank account not found: ${iban}`);
        }
        break;
      }
      case MigrationDraftKind.CAPITAL: {
        const accountCode = String(payload.accountCode ?? "");
        const acc = await this.prisma.account.findFirst({
          where: { organizationId, code: accountCode, ledgerType: LedgerType.NAS },
        });
        if (!acc) push("ACCOUNT_MISSING", `Account not found: ${accountCode}`);
        break;
      }
      case MigrationDraftKind.OPEN_ITEMS: {
        const voen = normalizeVoen(String(payload.voen ?? ""));
        const amount = Number(payload.amount ?? 0);
        if (!(amount > 0)) push("BAD_AMOUNT", "Open item amount must be > 0");
        const cp = await this.prisma.counterparty.findFirst({
          where: {
            organizationId,
            taxIdBlindIndex: blindIndex("voen", voen),
            deletedAt: null,
          },
        });
        if (!cp) push("COUNTERPARTY_MISSING", `Counterparty VÖEN not found: ${voen}`);
        const accountCode = String(payload.accountCode ?? "");
        const acc = await this.prisma.account.findFirst({
          where: { organizationId, code: accountCode, ledgerType: LedgerType.NAS },
        });
        if (!acc) push("ACCOUNT_MISSING", `Account not found: ${accountCode}`);
        break;
      }
      case MigrationDraftKind.ADVANCES:
      case MigrationDraftKind.PAYROLL_LIABILITIES: {
        const accountCode = String(payload.accountCode ?? "");
        const acc = await this.prisma.account.findFirst({
          where: { organizationId, code: accountCode, ledgerType: LedgerType.NAS },
        });
        if (!acc) push("ACCOUNT_MISSING", `Account not found: ${accountCode}`);
        break;
      }
      case MigrationDraftKind.HR_BALANCES: {
        const cpEmploymentId = String(payload.cpEmploymentId ?? "");
        const emp = await this.prisma.employee.findFirst({
          where: { organizationId, cpEmploymentId, deletedAt: null },
        });
        if (!emp) push("EMPLOYEE_MISSING", `Employee mirror missing: ${cpEmploymentId}`);
        break;
      }
      case MigrationDraftKind.FIXED_ASSETS: {
        const method = String(payload.method ?? "STRAIGHT_LINE");
        if (
          !(Object.values(FixedAssetDepreciationMethod) as string[]).includes(method)
        ) {
          push("BAD_METHOD", `Unknown depreciation method: ${method}`);
        }
        const life = Number(payload.remainingLifeMonths ?? 0);
        if (!(life > 0)) {
          push("BAD_LIFE", "remainingLifeMonths must be > 0");
        }
        const accountCode = String(payload.accountCode ?? "111");
        const acc = await this.prisma.account.findFirst({
          where: { organizationId, code: accountCode, ledgerType: LedgerType.NAS },
        });
        if (!acc) push("ACCOUNT_MISSING", `Account not found: ${accountCode}`);
        const inv = String(payload.inventoryNumber ?? "");
        const existing = await this.prisma.fixedAsset.findFirst({
          where: { organizationId, inventoryNumber: inv },
        });
        if (existing) push("FA_EXISTS", `Fixed asset already exists: ${inv}`);
        break;
      }
      default:
        break;
    }
  }

  async assemble(organizationId: string): Promise<{
    posted: number;
    transactionIds: string[];
  }> {
    const locked = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { migrationAssembledAt: true },
    });
    if (locked?.migrationAssembledAt) {
      throw new ConflictException("Already assembled");
    }

    const { ok, issues } = await this.validate(organizationId);
    if (!ok) {
      throw new BadRequestException({
        message: "Validation failed",
        issues,
      });
    }

    const org = await this.prisma.organization.findFirstOrThrow({
      where: { id: organizationId },
      select: { migrationCutoverDate: true, migrationAssembledAt: true },
    });
    if (org.migrationAssembledAt) {
      throw new ConflictException("Already assembled");
    }
    const cutover = org.migrationCutoverDate!;
    const drafts = await this.prisma.migrationDraftBatch.findMany({
      where: { organizationId, status: MigrationDraftStatus.DRAFT },
      include: { lines: { where: { error: null } } },
    });

    return this.prisma.$transaction(async (tx) => {
      const opening = await this.ensureTechnicalOpeningAccount(tx, organizationId);
      const transactionIds: string[] = [];

      for (const batch of drafts) {
        for (const line of batch.lines) {
          const payload = line.payload as Record<string, unknown>;
          const ids = await this.postLine(
            tx,
            organizationId,
            batch.kind,
            payload,
            cutover,
            opening.id,
          );
          transactionIds.push(...ids);
        }
        await tx.migrationDraftBatch.update({
          where: { id: batch.id },
          data: {
            status: MigrationDraftStatus.CONSUMED,
            consumedAt: new Date(),
          },
        });
      }

      await tx.organization.update({
        where: { id: organizationId },
        data: { migrationAssembledAt: new Date() },
      });

      return { posted: transactionIds.length, transactionIds };
    });
  }

  private async ensureTechnicalOpeningAccount(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ) {
    const nasBook = await this.accountingBooks.resolveByLedgerType(
      organizationId,
      LedgerType.NAS,
      tx,
    );
    const existing = await tx.account.findFirst({
      where: {
        organizationId,
        code: OPENING_ACCOUNT_CODE,
        ledgerType: LedgerType.NAS,
        accountingBookId: nasBook.id,
      },
    });
    if (existing) return existing;
    return tx.account.create({
      data: {
        organizationId,
        accountingBookId: nasBook.id,
        code: OPENING_ACCOUNT_CODE,
        nameAz: "İlkin qalıqlar texniki hesabı",
        nameRu: "Технический счёт начальных остатков",
        nameEn: "Opening balances technical account",
        type: AccountType.EQUITY,
        currency: "AZN",
        ledgerType: LedgerType.NAS,
      },
    });
  }

  private async postLine(
    tx: Prisma.TransactionClient,
    organizationId: string,
    kind: MigrationDraftKind,
    payload: Record<string, unknown>,
    cutover: Date,
    _openingAccountId: string,
  ): Promise<string[]> {
    const ids: string[] = [];

    const postPair = async (
      accountCode: string,
      amount: Prisma.Decimal,
      description: string,
      reference: string,
      counterpartyId?: string | null,
    ) => {
      if (amount.eq(0)) return;
      const account = await tx.account.findFirst({
        where: { organizationId, code: accountCode, ledgerType: LedgerType.NAS },
      });
      if (!account) throw new BadRequestException(`Account ${accountCode} not found`);
      const creditTarget =
        account.type === AccountType.LIABILITY ||
        account.type === AccountType.EQUITY ||
        account.type === AccountType.REVENUE;
      const journalLines: PostTransactionLine[] = creditTarget
        ? [
            { accountCode: OPENING_ACCOUNT_CODE, debit: amount.toString(), credit: 0 },
            { accountCode, debit: 0, credit: amount.toString() },
          ]
        : [
            { accountCode, debit: amount.toString(), credit: 0 },
            { accountCode: OPENING_ACCOUNT_CODE, debit: 0, credit: amount.toString() },
          ];
      this.accounting.validateBalance(journalLines);
      const posted = await this.accounting.postJournalInTransaction(tx, {
        organizationId,
        date: cutover,
        reference,
        description,
        isFinal: true,
        counterpartyId: counterpartyId ?? null,
        lines: journalLines,
      });
      ids.push(posted.transactionId);
    };

    switch (kind) {
      case MigrationDraftKind.CASH_BANK: {
        await postPair(
          String(payload.accountCode),
          new Decimal(Number(payload.amount)),
          "Opening cash/bank",
          "OPENING-CASH-BANK",
        );
        break;
      }
      case MigrationDraftKind.CAPITAL: {
        await postPair(
          String(payload.accountCode),
          new Decimal(Number(payload.amount)),
          "Opening capital",
          "OPENING-CAPITAL",
        );
        break;
      }
      case MigrationDraftKind.STOCK: {
        const sku = String(payload.sku);
        const warehouseCode = String(payload.warehouseCode);
        const quantity = new Decimal(Number(payload.quantity));
        const costPrice = new Decimal(Number(payload.costPrice));
        const amount = quantity.mul(costPrice);
        const product = await tx.product.findFirstOrThrow({
          where: { organizationId, sku, deletedAt: null },
        });
        const warehouse = await tx.warehouse.findFirstOrThrow({
          where: { organizationId, code: warehouseCode, deletedAt: null },
        });
        const [finishedGoodsCode, inventoryGoodsCode] = await Promise.all([
          this.posting.resolveAccountCode(organizationId, "FINISHED_GOODS", tx),
          this.posting.resolveAccountCode(organizationId, "INVENTORY_GOODS", tx),
        ]);
        const invAccountCode =
          warehouse.inventoryAccountCode === finishedGoodsCode
            ? finishedGoodsCode
            : inventoryGoodsCode;

        const currentItem = await tx.stockItem.findUnique({
          where: {
            organizationId_warehouseId_productId: {
              organizationId,
              warehouseId: warehouse.id,
              productId: product.id,
            },
          },
        });
        if (currentItem) {
          const q1 = currentItem.quantity.add(quantity);
          const c1 = q1.lte(0)
            ? new Decimal(0)
            : currentItem.quantity
                .mul(currentItem.averageCost)
                .add(quantity.mul(costPrice))
                .div(q1);
          await tx.stockItem.update({
            where: { id: currentItem.id },
            data: { quantity: q1, averageCost: c1 },
          });
        } else {
          await tx.stockItem.create({
            data: {
              organizationId,
              warehouseId: warehouse.id,
              productId: product.id,
              quantity,
              averageCost: costPrice,
            },
          });
        }
        await tx.stockMovement.create({
          data: {
            organizationId,
            warehouseId: warehouse.id,
            productId: product.id,
            type: StockMovementType.IN,
            reason: StockMovementReason.ADJUSTMENT,
            quantity,
            price: costPrice,
            note: "OPENING_BALANCE_INVENTORY",
            documentDate: cutover,
          },
        });
        await postPair(invAccountCode, amount, "Opening stock", "OPENING-STOCK");
        break;
      }
      case MigrationDraftKind.OPEN_ITEMS: {
        const side = String(payload.side).toLowerCase();
        const amount = new Decimal(Number(payload.amount));
        const accountCode = String(payload.accountCode);
        const docNo = String(payload.documentNumber);
        const voen = normalizeVoen(String(payload.voen));
        const cp = await tx.counterparty.findFirstOrThrow({
          where: {
            organizationId,
            taxIdBlindIndex: blindIndex("voen", voen),
            deletedAt: null,
          },
        });
        if (side === "ar") {
          await postPair(
            accountCode,
            amount,
            `Opening AR ${docNo}`,
            "OPENING-OPEN-ITEM-AR",
            cp.id,
          );
          await tx.invoice.create({
            data: {
              organizationId,
              counterpartyId: cp.id,
              number: docNo,
              status: InvoiceStatus.SENT,
              dueDate: payload.dueDate
                ? new Date(String(payload.dueDate))
                : new Date(String(payload.documentDate)),
              currency: "AZN",
              totalAmount: amount,
              paidAmount: new Decimal(0),
              debitAccountCode: accountCode,
              revenueRecognized: true,
              extraAttributes: {
                migrationOpening: true,
                documentDate: String(payload.documentDate),
              },
            },
          });
        } else {
          await postPair(
            accountCode,
            amount,
            `Opening AP ${docNo} VÖEN ${voen}`,
            "OPENING-OPEN-ITEM-AP",
            cp.id,
          );
          const lastId = ids[ids.length - 1];
          if (lastId) {
            await tx.transaction.update({
              where: { id: lastId },
              data: {
                purchaseSnapshot: {
                  migrationOpening: true,
                  side: "ap",
                  documentNumber: docNo,
                  documentDate: String(payload.documentDate ?? ""),
                  voen,
                  amount: amount.toString(),
                },
              },
            });
          }
        }
        break;
      }
      case MigrationDraftKind.ADVANCES:
      case MigrationDraftKind.PAYROLL_LIABILITIES: {
        await postPair(
          String(payload.accountCode),
          new Decimal(Number(payload.amount)),
          `Opening ${kind}`,
          `OPENING-${kind}`,
        );
        break;
      }
      case MigrationDraftKind.HR_BALANCES: {
        const cpEmploymentId = String(payload.cpEmploymentId);
        const emp = await tx.employee.findFirstOrThrow({
          where: { organizationId, cpEmploymentId, deletedAt: null },
        });
        await tx.employee.update({
          where: { id: emp.id },
          data: {
            initialSalaryBalance: new Decimal(Number(payload.salaryDebt ?? 0)),
            initialVacationDays: new Decimal(Number(payload.vacationDays ?? 0)),
            avgMonthlySalaryLastYear:
              payload.avgMonthlySalary != null
                ? new Decimal(Number(payload.avgMonthlySalary))
                : emp.avgMonthlySalaryLastYear,
          },
        });
        const debt = new Decimal(Number(payload.salaryDebt ?? 0));
        if (debt.gt(0)) {
          await postPair(String("521"), debt, "Opening salary debt", "OPENING-HR");
        }
        break;
      }
      case MigrationDraftKind.FIXED_ASSETS: {
        const originalCost = new Decimal(Number(payload.originalCost));
        const booked = new Decimal(Number(payload.accumulatedDepreciation ?? 0));
        const method = String(
          payload.method ?? "STRAIGHT_LINE",
        ) as FixedAssetDepreciationMethod;
        const remaining = Number(payload.remainingLifeMonths);
        await tx.fixedAsset.create({
          data: {
            organizationId,
            inventoryNumber: String(payload.inventoryNumber),
            name: String(payload.name),
            purchaseDate: cutover,
            purchasePrice: originalCost,
            usefulLifeMonths: remaining,
            salvageValue: new Decimal(0),
            depreciationMethod: method,
            bookedDepreciation: booked,
          },
        });
        const net = originalCost.sub(booked);
        if (net.gt(0)) {
          await postPair(
            String(payload.accountCode || "111"),
            net,
            "Opening fixed asset",
            "OPENING-FA",
          );
        }
        break;
      }
      case MigrationDraftKind.VAT_REGISTER:
        // Register rows stay as draft evidence; no GL post in v1 assemble.
        break;
      default:
        break;
    }

    return ids;
  }
}
