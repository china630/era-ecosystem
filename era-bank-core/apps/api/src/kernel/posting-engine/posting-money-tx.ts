import { Prisma } from "@era/bank-core-database";
import {
  assertTenantRawOrganizationId,
  assertTenantRawSqlMentionsOrg,
} from "@era/satellite-kit/tenancy";

/** Prisma P2034 = write conflict / serialization failure — retry. */
export function isSerializationFailure(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2034"
  );
}

export type MoneyTxClient = {
  $queryRawUnsafe: <T = unknown>(
    query: string,
    ...values: unknown[]
  ) => Promise<T>;
  account: {
    findFirst: (args: unknown) => Promise<{
      id: string;
      status: string;
      currency: string;
      ledgerBalanceMinor: bigint;
      overdraftLimitMinor: bigint;
    } | null>;
    update: (args: unknown) => Promise<unknown>;
  };
  accountHold: {
    aggregate: (args: unknown) => Promise<{
      _sum: { amountMinor: bigint | null };
    }>;
  };
};

const LOCK_ACCOUNT_SQL =
  `SELECT id FROM accounts WHERE id = $1 AND organization_id = $2 FOR UPDATE`;

const LOCK_NOSTRO_SQL =
  `SELECT id FROM nostro_vostro_accounts WHERE id = $1 AND organization_id = $2 FOR UPDATE`;

/**
 * Lock customer accounts in id order (deadlock-safe) via SELECT … FOR UPDATE.
 * Prisma has no row lock. The org filter keeps a SHARED bank from locking another org's row.
 */
export async function lockAccountsForUpdate(
  tx: MoneyTxClient,
  accountIds: string[],
  organizationId: string,
): Promise<void> {
  const orgId = assertTenantRawOrganizationId(organizationId);
  assertTenantRawSqlMentionsOrg(LOCK_ACCOUNT_SQL);
  const unique = [...new Set(accountIds.filter(Boolean))].sort();
  for (const id of unique) {
    await tx.$queryRawUnsafe(LOCK_ACCOUNT_SQL, id, orgId);
  }
}

/**
 * Lock nostro/vostro register rows in id order (deadlock-safe).
 */
export async function lockNostroAccountsForUpdate(
  tx: { $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T> },
  nostroAccountIds: string[],
  organizationId: string,
): Promise<void> {
  const orgId = assertTenantRawOrganizationId(organizationId);
  assertTenantRawSqlMentionsOrg(LOCK_NOSTRO_SQL);
  const unique = [...new Set(nostroAccountIds.filter(Boolean))].sort();
  for (const id of unique) {
    await tx.$queryRawUnsafe(LOCK_NOSTRO_SQL, id, orgId);
  }
}

export function computeAvailableMinor(input: {
  ledgerBalanceMinor: bigint;
  heldMinor: bigint;
  overdraftLimitMinor: bigint;
}): bigint {
  return (
    input.ledgerBalanceMinor - input.heldMinor + input.overdraftLimitMinor
  );
}

const MAX_SERIALIZATION_RETRIES = 5;

export async function runSerializableMoneyTx<T>(
  prisma: {
    $transaction: (
      fn: (tx: unknown) => Promise<T>,
      options?: {
        isolationLevel?: Prisma.TransactionIsolationLevel;
        maxWait?: number;
        timeout?: number;
      },
    ) => Promise<T>;
  },
  fn: (tx: unknown) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 30_000,
      });
    } catch (err) {
      lastErr = err;
      if (!isSerializationFailure(err) || attempt === MAX_SERIALIZATION_RETRIES - 1) {
        throw err;
      }
    }
  }
  throw lastErr;
}
