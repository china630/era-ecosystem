import { BadRequestException, Injectable } from "@nestjs/common";
import { OrganizationKind, Prisma, type PostingRole } from "@erafinance/database";
import { AccountingService, type PostTransactionLine } from "../accounting.service";
import { PostingAccountResolver } from "./posting-account-resolver.service";
import { assertBudgetInvoiceSchemaSafe } from "./posting-kind-guard";
import {
  assertSchemaAllowedForKind,
  getPostingSchema,
  type PostingSchemaId,
} from "./posting-schema-registry";

export type BuildJournalParams = {
  organizationId: string;
  schemaId: PostingSchemaId;
  amounts: Record<string, string | number | Prisma.Decimal>;
  date: Date;
  reference?: string;
  description: string;
  dynamicAccounts?: {
    debitAccountCode?: string;
    creditAccountCode?: string;
  };
  counterpartyId?: string;
};

@Injectable()
export class PostingJournalBuilder {
  constructor(
    private readonly resolver: PostingAccountResolver,
    private readonly accounting: AccountingService,
  ) {}

  async buildLines(
    organizationId: string,
    schemaId: PostingSchemaId,
    amounts: Record<string, string | number | Prisma.Decimal>,
    dynamicAccounts?: BuildJournalParams["dynamicAccounts"],
    tx?: Prisma.TransactionClient,
  ): Promise<PostTransactionLine[]> {
    const kind = await this.resolver.getOrganizationKind(organizationId);
    assertSchemaAllowedForKind(kind, schemaId);
    const schema = getPostingSchema(schemaId);
    const lines: PostTransactionLine[] = [];
    const resolvedCodes: string[] = [];

    for (const row of schema.lines) {
      const raw = amounts[row.amountKey];
      if (raw == null) {
        throw new BadRequestException(
          `Posting schema ${schemaId}: missing amount key ${row.amountKey}`,
        );
      }
      const amount = new Prisma.Decimal(raw);
      if (amount.lte(0)) continue;

      let accountCode: string;
      if (row.useDynamicAccountKey && dynamicAccounts?.[row.useDynamicAccountKey]) {
        accountCode = dynamicAccounts[row.useDynamicAccountKey]!.trim();
      } else {
        accountCode = await this.resolver.resolveAccountCode(
          organizationId,
          row.role as PostingRole,
          tx,
        );
      }
      resolvedCodes.push(accountCode);
      lines.push({
        accountCode,
        debit: row.side === "DEBIT" ? amount.toString() : 0,
        credit: row.side === "CREDIT" ? amount.toString() : 0,
      });
    }

    if (lines.length < 2) {
      throw new BadRequestException(`Posting schema ${schemaId}: no balanced lines produced`);
    }

    assertBudgetInvoiceSchemaSafe(kind, schemaId, resolvedCodes);
    this.accounting.validateBalance(lines);
    return lines;
  }

  async postInTransaction(
    tx: Prisma.TransactionClient,
    params: BuildJournalParams,
  ): Promise<{ transactionId: string }> {
    const lines = await this.buildLines(
      params.organizationId,
      params.schemaId,
      params.amounts,
      params.dynamicAccounts,
      tx,
    );
    return this.accounting.postJournalInTransaction(tx, {
      organizationId: params.organizationId,
      date: params.date,
      reference: params.reference,
      description: params.description,
      lines,
      counterpartyId: params.counterpartyId,
    });
  }
}
