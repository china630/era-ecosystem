import {
  computeAvailableMinor,
  isSerializationFailure,
  lockAccountsForUpdate,
  lockNostroAccountsForUpdate,
  runSerializableMoneyTx,
} from "../src/kernel/posting-engine/posting-money-tx";

describe("posting concurrency / money isolation helpers (P0-1)", () => {
  it("computes available as ledger − holds + overdraft", () => {
    expect(
      computeAvailableMinor({
        ledgerBalanceMinor: 100_00n,
        heldMinor: 20_00n,
        overdraftLimitMinor: 0n,
      }),
    ).toBe(80_00n);
  });

  const orgId = "6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b";

  it("locks accounts in sorted id order for one organization", async () => {
    const seen: { id: string; org: string; sql: string }[] = [];
    const tx = {
      $queryRawUnsafe: async (sql: string, id: string, org: string) => {
        seen.push({ id, org, sql });
        return [{ id }];
      },
      account: { findFirst: async () => null, update: async () => null },
      accountHold: { aggregate: async () => ({ _sum: { amountMinor: null } }) },
    };
    await lockAccountsForUpdate(tx as never, ["c", "a", "b", "a"], orgId);
    expect(seen.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(seen.every((row) => row.org === orgId && row.sql.includes("organization_id"))).toBe(true);
  });

  it("locks nostro accounts in sorted id order for one organization", async () => {
    const seen: { id: string; org: string; sql: string }[] = [];
    const tx = {
      $queryRawUnsafe: async (sql: string, id: string, org: string) => {
        seen.push({ id, org, sql });
        return [{ id }];
      },
    };
    await lockNostroAccountsForUpdate(tx as never, ["n2", "n1", "n2"], orgId);
    expect(seen.map((row) => row.id)).toEqual(["n1", "n2"]);
    expect(seen.every((row) => row.org === orgId && row.sql.includes("organization_id"))).toBe(true);
  });

  it("refuses a lock without an organization", async () => {
    const tx = { $queryRawUnsafe: async () => [] };
    await expect(lockAccountsForUpdate(tx as never, ["a"], "")).rejects.toThrow(
      /organizationId is required/,
    );
    await expect(lockNostroAccountsForUpdate(tx as never, ["n"], "")).rejects.toThrow(
      /organizationId is required/,
    );
  });

  it("detects Prisma P2034 serialization failures", () => {
    expect(isSerializationFailure({ code: "P2034" })).toBe(true);
    expect(isSerializationFailure({ code: "P2002" })).toBe(false);
    expect(isSerializationFailure(null)).toBe(false);
  });

  /**
   * Simulated race under FOR UPDATE semantics: serial apply admits
   * floor(balance/debit) successes. This is a unit model of the algorithm —
   * not a substitute for the DB integration test below.
   */
  it("serial apply admits exactly floor(balance/debit) successes", () => {
    const debit = 10_00n;
    let ledger = 100_00n;
    let successes = 0;
    for (let i = 0; i < 50; i++) {
      const available = computeAvailableMinor({
        ledgerBalanceMinor: ledger,
        heldMinor: 0n,
        overdraftLimitMinor: 0n,
      });
      if (debit <= available) {
        ledger -= debit;
        successes += 1;
      }
    }
    expect(successes).toBe(10);
    expect(ledger).toBe(0n);
  });

  it("runSerializableMoneyTx retries on P2034 then succeeds", async () => {
    let attempts = 0;
    const prisma = {
      $transaction: async (fn: (tx: unknown) => Promise<string>) => {
        attempts += 1;
        if (attempts < 3) {
          const err = Object.assign(new Error("write conflict"), {
            code: "P2034",
          });
          throw err;
        }
        return fn({});
      },
    };
    const result = await runSerializableMoneyTx(prisma, async () => "ok");
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });
});

/**
 * Optional DB integration: 50 parallel debit attempts against one account.
 * Requires DATABASE_URL and a migrated bank-core schema. Skipped otherwise.
 *
 * Recipe (OPEN-TASKS P0-1 diamond proof):
 *   DATABASE_URL=<migrated bank postgres> BANK_CONCURRENCY_DB_TEST=1 npm test -- posting-concurrency
 * Resolves bankOrgId via BankInstitutionConfig / Branch (no BankOrganization model).
 * Unit suite remains default CI; do not claim race diamond closed without this evidence.
 */
describe("posting concurrency DB integration (optional)", () => {
  const url = process.env.DATABASE_URL?.trim();
  const runDb = Boolean(url) && process.env.BANK_CONCURRENCY_DB_TEST === "1";

  (runDb ? it : it.skip)(
    "50 parallel Serializable debits leave non-negative available",
    async () => {
      // Dynamic import keeps unit suite free of Prisma client when skipped.
      // Resolves tenant via BankInstitutionConfig / Branch — there is no BankOrganization model.
      // Exercises Serializable + FOR UPDATE + available recompute (same helpers PostingEngine uses).
      const { PrismaClient, Prisma } = await import("@era/bank-core-database");
      const prisma = new PrismaClient();
      const bankOrgId =
        process.env.BANK_ORG_ID?.trim() ||
        process.env.ERA_BANK_ORGANIZATION_ID?.trim() ||
        (
          await prisma.bankInstitutionConfig.findFirst({
            select: { bankOrgId: true },
          })
        )?.bankOrgId ||
        (
          await prisma.branch.findFirst({
            select: { bankOrgId: true },
          })
        )?.bankOrgId;
      if (!bankOrgId) {
        await prisma.$disconnect();
        throw new Error(
          "No bankOrgId for concurrency test (set BANK_ORG_ID / ERA_BANK_ORGANIZATION_ID or seed)",
        );
      }

      const branch = await prisma.branch.findFirst({
        where: { bankOrgId },
      });
      const gl = await prisma.glAccount.findFirst({ where: { bankOrgId } });
      const customer = await prisma.bankCustomer.findFirst({
        where: { bankOrgId },
      });
      if (!branch || !gl || !customer) {
        await prisma.$disconnect();
        throw new Error("Seed branch/gl/customer required for concurrency test");
      }

      const account = await prisma.account.create({
        data: {
          bankOrgId,
          organizationId: bankOrgId,
          iban: `AZCONC${Date.now()}`,
          customerId: customer.id,
          branchId: branch.id,
          glAccountId: gl.id,
          currency: "AZN",
          ledgerBalanceMinor: 100_00n,
          availableBalanceMinor: 100_00n,
          overdraftLimitMinor: 0n,
        },
      });

      const debit = 10_00n;
      const attempts = Array.from({ length: 50 }, (_, i) => i);

      const results = await Promise.allSettled(
        attempts.map(async () =>
          runSerializableMoneyTx(prisma, async (txRaw) => {
            const tx = txRaw as typeof prisma;
            await lockAccountsForUpdate(tx as never, [account.id], bankOrgId);
            const row = await tx.account.findFirst({
              where: { id: account.id },
            });
            if (!row) throw new Error("missing account");
            const holds = await tx.accountHold.aggregate({
              where: { accountId: account.id, status: "ACTIVE" },
              _sum: { amountMinor: true },
            });
            const held = holds._sum.amountMinor ?? 0n;
            const available = computeAvailableMinor({
              ledgerBalanceMinor: row.ledgerBalanceMinor,
              heldMinor: held,
              overdraftLimitMinor: row.overdraftLimitMinor,
            });
            if (debit > available) {
              throw new Error("Insufficient available balance");
            }
            const nextLedger = row.ledgerBalanceMinor - debit;
            const nextAvailable = computeAvailableMinor({
              ledgerBalanceMinor: nextLedger,
              heldMinor: held,
              overdraftLimitMinor: row.overdraftLimitMinor,
            });
            await tx.account.update({
              where: { id: account.id },
              data: {
                ledgerBalanceMinor: nextLedger,
                availableBalanceMinor: nextAvailable,
              },
            });
            return true;
          }),
        ),
      );

      const successes = results.filter((r) => r.status === "fulfilled").length;
      const final = await prisma.account.findFirstOrThrow({
        where: { id: account.id },
      });

      expect(successes).toBe(10);
      expect(final.ledgerBalanceMinor).toBe(0n);
      expect(final.availableBalanceMinor).toBe(0n);
      expect(final.ledgerBalanceMinor >= 0n).toBe(true);

      await prisma.account.delete({ where: { id: account.id } });
      await prisma.$disconnect();
      void Prisma;
    },
    60_000,
  );
});
