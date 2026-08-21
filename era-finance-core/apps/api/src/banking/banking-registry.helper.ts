import {
  BankStatementChannel,
  BankStatementLineOrigin,
  BankStatementLineType,
  Decimal,
  isNasCashDeskCode,
  OrganizationKind,
  type Prisma,
} from "@erafinance/database";

type Tx = Prisma.TransactionClient;

/**
 * Зеркальная строка реестра при оплате инвойса из UI (не при bank match).
 */
export async function createInvoicePaymentMirrorLine(
  tx: Tx,
  organizationId: string,
  params: {
    invoiceId: string;
    invoiceNumber: string;
    amount: Decimal;
    valueDate: Date;
    counterpartyTaxId: string | null;
    debitAccountCode: string;
    paymentId: string;
  },
): Promise<void> {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { kind: true },
  });
  const kind = org?.kind ?? OrganizationKind.COMMERCIAL;
  const channel = isNasCashDeskCode(kind, params.debitAccountCode)
    ? BankStatementChannel.CASH
    : BankStatementChannel.BANK;

  const stmt = await tx.bankStatement.create({
    data: {
      organizationId,
      date: params.valueDate,
      totalAmount: params.amount,
      bankName: "SYSTEM",
      channel,
    },
  });

  await tx.bankStatementLine.create({
    data: {
      organizationId,
      bankStatementId: stmt.id,
      description: `Invoice ${params.invoiceNumber}`,
      amount: params.amount,
      type: BankStatementLineType.INFLOW,
      origin: BankStatementLineOrigin.INVOICE_PAYMENT_SYSTEM,
      isMatched: true,
      matchedInvoiceId: params.invoiceId,
      valueDate: params.valueDate,
      counterpartyTaxId: params.counterpartyTaxId,
      integrationKey: `inv:${params.invoiceId}:pay:${params.paymentId}`,
    },
  });
}
