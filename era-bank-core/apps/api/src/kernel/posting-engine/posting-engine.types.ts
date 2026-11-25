import { TxnType } from "@era/bank-core-database";

export interface PostingLegInput {
  accountId?: string;
  glAccountId: string;
  branchId: string;
  debitMinor: bigint;
  creditMinor: bigint;
  currency: string;
}

/** Nostro/vostro cache update applied inside the same Serializable money tx as the journal. */
export interface NostroBalanceAdjustment {
  nostroAccountId: string;
  /** Signed: credit − debit semantics (positive increases nostro ledger). */
  deltaMinor: bigint;
}

export interface PostingRequest {
  reference: string;
  idempotencyKey: string;
  valueDate: Date;
  type: TxnType;
  makerUserId: string;
  branchId?: string;
  legs: PostingLegInput[];
  autoApprove?: boolean;
  /** Internal EOD / system steps may post while EodRun is RUNNING. */
  allowDuringEod?: boolean;
  /** Optional nostro register updates locked FOR UPDATE in the same money tx (ADR D6). */
  nostroAdjustments?: NostroBalanceAdjustment[];
  /**
   * Domain side-effects (loan outstanding, schedule, …) run inside the same
   * Serializable transaction after balances are applied — keeps money + register atomic.
   * `journalTxn` is the created (or pending) journal row.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sideEffectsInTx?: (tx: any, journalTxn: { id: string }) => Promise<void>;
}

export interface ApprovePostingRequest {
  transactionId: string;
  checkerUserId: string;
}

export interface ReversePostingRequest {
  transactionId: string;
  makerUserId: string;
  reason: string;
  idempotencyKey: string;
}

/** Txn types requiring maker-checker (PENDING until approve). */
export const CONTROLLED_TXN_TYPES: ReadonlySet<TxnType> = new Set([
  TxnType.TRANSFER,
  TxnType.WITHDRAWAL,
  TxnType.PAYMENT,
  TxnType.INTERBRANCH,
  TxnType.FX,
]);

export interface CurrencyTotals {
  currency: string;
  debitMinor: bigint;
  creditMinor: bigint;
}
