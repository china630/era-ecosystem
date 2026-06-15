/** Post-commit hooks — modules register listeners without kernel importing modules. */

export type PostingCommittedPayload = {
  transactionId: string;
  bankOrgId: string;
  type: string;
  entries: Array<{
    accountId?: string | null;
    debitMinor: bigint;
    creditMinor: bigint;
    currency: string;
  }>;
};

type Handler = (payload: PostingCommittedPayload) => Promise<void>;

const handlers: Handler[] = [];

export function registerPostingCommittedHandler(handler: Handler): void {
  handlers.push(handler);
}

export async function emitPostingCommitted(payload: PostingCommittedPayload): Promise<void> {
  for (const handler of handlers) {
    await handler(payload).catch(() => undefined);
  }
}
