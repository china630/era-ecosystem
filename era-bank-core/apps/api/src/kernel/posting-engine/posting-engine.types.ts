import { TxnType } from "@era/bank-core-database";

export interface PostingLegInput {
  accountId?: string;
  glAccountId: string;
  branchId: string;
  debitMinor: bigint;
  creditMinor: bigint;
  currency: string;
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
