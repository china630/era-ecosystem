/** In-process queue seam for credit registry debt-status batches (stub/live swap later). */

export type CreditDebtStatusQueueEntry = {
  id: string;
  loanId: string;
  customerId: string;
  previousStatus: string | null;
  newStatus: string;
  changedAt: string;
  enqueuedAt: string;
};

export interface CreditDebtStatusQueue {
  enqueue(entry: Omit<CreditDebtStatusQueueEntry, "id" | "enqueuedAt">): CreditDebtStatusQueueEntry;
  listPending(): CreditDebtStatusQueueEntry[];
  markSubmitted(id: string): void;
}

export class InMemoryCreditDebtStatusQueue implements CreditDebtStatusQueue {
  private readonly items = new Map<string, CreditDebtStatusQueueEntry>();
  private seq = 0;

  enqueue(
    entry: Omit<CreditDebtStatusQueueEntry, "id" | "enqueuedAt">,
  ): CreditDebtStatusQueueEntry {
    const id = `ckr-q-${++this.seq}`;
    const row: CreditDebtStatusQueueEntry = {
      ...entry,
      id,
      enqueuedAt: new Date().toISOString(),
    };
    this.items.set(id, row);
    return row;
  }

  listPending(): CreditDebtStatusQueueEntry[] {
    return [...this.items.values()];
  }

  markSubmitted(id: string): void {
    this.items.delete(id);
  }
}