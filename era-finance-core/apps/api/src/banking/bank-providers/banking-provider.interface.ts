export type BankBalanceItem = {
  accountId: string;
  iban?: string | null;
  currency: string;
  amount: string;
};

export type BankStatementItem = {
  externalId: string;
  amount: string;
  currency: string;
  date: string;
  description?: string | null;
  counterpartyIban?: string | null;
  counterpartyName?: string | null;
};

export type PaymentDraftRequest = {
  fromAccountIban: string;
  toIban: string;
  amount: string;
  currency: string;
  purpose: string;
  reference?: string;
};

export type PaymentDraftResult = {
  draftId: string;
  status: string;
  providerPayload?: unknown;
};

/** Per-organization key from the platform access catalog. API URL stays on the adapter. */
export type OrgBankCall = {
  clientId?: string;
  login?: string;
  cif?: string;
  secret: string;
};

export interface BankingProviderInterface {
  getBalances(creds?: OrgBankCall): Promise<BankBalanceItem[]>;
  getStatements(from: string, to: string, creds?: OrgBankCall): Promise<BankStatementItem[]>;
  sendPaymentDraft(payload: PaymentDraftRequest, creds?: OrgBankCall): Promise<PaymentDraftResult>;
}

