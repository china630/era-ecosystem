import { Injectable } from "@nestjs/common";
import { LedgerType, Prisma } from "@erafinance/database";
import type { SubcontoService } from "./subconto.service";

type Decimal = Prisma.Decimal;

@Injectable()
export class IfrsAutoMappingService {
  async mirrorFromNas(params: {
    tx: Prisma.TransactionClient;
    organizationId: string;
    transactionId: string;
    nasLines: Array<{
      accountCode: string;
      debit: Decimal;
      credit: Decimal;
      journalEntryId: string;
    }>;
    subcontoService?: SubcontoService;
  }): Promise<void> {
    const { tx, organizationId, transactionId, nasLines, subcontoService } =
      params;
    if (nasLines.length === 0) return;

    const sourceCodes = [...new Set(nasLines.map((l) => l.accountCode))];
    const rules = await tx.ifrsMappingRule.findMany({
      where: {
        organizationId,
        isActive: true,
        sourceNasAccountCode: { in: sourceCodes },
      },
    });
    if (rules.length === 0) return;

    const targetCodes = [...new Set(rules.map((r) => r.targetIfrsAccountCode))];
    const ifrsAccounts = await tx.account.findMany({
      where: {
        organizationId,
        ledgerType: LedgerType.IFRS,
        code: { in: targetCodes },
      },
      select: { id: true, code: true },
    });
    const ifrsByCode = new Map(ifrsAccounts.map((a) => [a.code, a.id]));

    const ruleBySource = new Map<string, string>();
    for (const r of rules) {
      if (!ifrsByCode.has(r.targetIfrsAccountCode)) continue;
      if (!ruleBySource.has(r.sourceNasAccountCode)) {
        ruleBySource.set(r.sourceNasAccountCode, r.targetIfrsAccountCode);
      }
    }

    const staged: Array<{
      accountId: string;
      debit: Decimal;
      credit: Decimal;
      sourceJournalEntryId: string;
    }> = [];
    for (const line of nasLines) {
      const targetCode = ruleBySource.get(line.accountCode);
      if (!targetCode) return;
      const accountId = ifrsByCode.get(targetCode);
      if (!accountId) return;
      staged.push({
        accountId,
        debit: line.debit,
        credit: line.credit,
        sourceJournalEntryId: line.journalEntryId,
      });
    }

    let sumDr = new Prisma.Decimal(0);
    let sumCr = new Prisma.Decimal(0);
    for (const line of staged) {
      sumDr = sumDr.add(line.debit);
      sumCr = sumCr.add(line.credit);
    }
    if (!sumDr.equals(sumCr)) return;

    for (const line of staged) {
      const ifrsEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          transactionId,
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          ledgerType: LedgerType.IFRS,
        },
      });
      if (subcontoService) {
        await subcontoService.copyDimensionsToMirroredEntry(
          tx,
          line.sourceJournalEntryId,
          ifrsEntry.id,
        );
      }
    }
  }
}
