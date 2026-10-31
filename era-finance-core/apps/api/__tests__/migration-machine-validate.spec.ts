import { BadRequestException, ConflictException } from "@nestjs/common";
import { MigrationDraftKind, MigrationDraftStatus } from "@erafinance/database";
import { MigrationAssembleService } from "../src/migration/migration-assemble.service";

function makeService(prisma: Record<string, unknown>) {
  return new MigrationAssembleService(
    prisma as never,
    { validateBalance: () => undefined, postJournalInTransaction: async () => ({ transactionId: "t1" }) } as never,
    { resolveByLedgerType: async () => ({ id: "book-nas" }) } as never,
    { resolveAccountCode: async () => "201" } as never,
    { handleHired: async () => undefined } as never,
    { forward: async () => ({ items: [] }) } as never,
  );
}

describe("Migration machine validate / assemble guards (AC-FIN-MIG)", () => {
  it("validate fails without cutover (NO_CUTOVER)", async () => {
    const prisma = {
      organization: {
        findFirstOrThrow: async () => ({
          migrationCutoverDate: null,
          migrationAssembledAt: null,
          taxIdBlindIndex: "x",
        }),
      },
      migrationDraftBatch: { findMany: async () => [] },
      product: { count: async () => 1 },
      transaction: { count: async () => 0 },
    };
    const svc = makeService(prisma);
    const res = await svc.validate("org-1");
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "NO_CUTOVER")).toBe(true);
    expect(res.trial000).toBeDefined();
  });

  it("validate fails when already assembled", async () => {
    const prisma = {
      organization: {
        findFirstOrThrow: async () => ({
          migrationCutoverDate: new Date("2026-01-01"),
          migrationAssembledAt: new Date("2026-01-02"),
          taxIdBlindIndex: "x",
        }),
      },
      migrationDraftBatch: { findMany: async () => [] },
      product: { count: async () => 0 },
      transaction: { count: async () => 0 },
    };
    const svc = makeService(prisma);
    const res = await svc.validate("org-1");
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "ALREADY_ASSEMBLED")).toBe(true);
  });

  it("validate flags TECH_000_IMBALANCE when cash without capital", async () => {
    const prisma = {
      organization: {
        findFirstOrThrow: async () => ({
          migrationCutoverDate: new Date("2026-01-01T00:00:00.000Z"),
          migrationAssembledAt: null,
          taxIdBlindIndex: "x",
        }),
      },
      migrationDraftBatch: {
        findMany: async () => [
          {
            kind: MigrationDraftKind.CASH_BANK,
            status: MigrationDraftStatus.DRAFT,
            lines: [
              {
                rowNumber: 2,
                error: null,
                payload: { accountCode: "221", amount: 1000 },
              },
            ],
          },
        ],
      },
      account: {
        findFirst: async ({ where }: { where: { code?: string } }) => {
          if (where.code === "221") {
            return { code: "221", type: "ASSET" };
          }
          return null;
        },
      },
      organizationBankAccount: { findFirst: async () => null },
      product: { count: async () => 1 },
      transaction: { count: async () => 0 },
    };
    const svc = makeService(prisma);
    const res = await svc.validate("org-1");
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "TECH_000_IMBALANCE")).toBe(true);
    expect(Number(res.trial000)).not.toBe(0);
  });

  it("validate flags SERVICE_IN_STOCK", async () => {
    const prisma = {
      organization: {
        findFirstOrThrow: async () => ({
          migrationCutoverDate: new Date("2026-01-01T00:00:00.000Z"),
          migrationAssembledAt: null,
          taxIdBlindIndex: "x",
        }),
      },
      migrationDraftBatch: {
        findMany: async () => [
          {
            kind: MigrationDraftKind.STOCK,
            status: MigrationDraftStatus.DRAFT,
            lines: [
              {
                rowNumber: 2,
                error: null,
                payload: {
                  sku: "SVC-1",
                  warehouseCode: "MAIN",
                  quantity: 1,
                  costPrice: 1,
                },
              },
            ],
          },
          {
            kind: MigrationDraftKind.CAPITAL,
            status: MigrationDraftStatus.DRAFT,
            lines: [
              {
                rowNumber: 2,
                error: null,
                payload: { accountCode: "301", amount: 1 },
              },
            ],
          },
        ],
      },
      product: {
        findFirst: async () => ({
          sku: "SVC-1",
          isService: true,
          revenueAccountCode: "601",
        }),
        count: async () => 1,
      },
      warehouse: { findFirst: async () => ({ id: "w1", code: "MAIN" }) },
      account: {
        findFirst: async ({ where }: { where: { code?: string } }) => {
          if (where.code === "301") return { code: "301", type: "EQUITY" };
          return { code: where.code, type: "ASSET" };
        },
      },
      transaction: { count: async () => 0 },
    };
    const svc = makeService(prisma);
    const res = await svc.validate("org-1");
    const stockIssue = res.issues.find((i) => i.code === "SERVICE_IN_STOCK");
    expect(stockIssue).toBeDefined();
    expect(stockIssue?.kind).toBe("stock");
  });

  it("assemble rejects with Conflict when already assembled", async () => {
    const prisma = {
      organization: {
        findFirst: async () => ({ migrationAssembledAt: new Date() }),
        findFirstOrThrow: async () => ({
          migrationCutoverDate: new Date("2026-01-01"),
          migrationAssembledAt: new Date(),
          taxIdBlindIndex: "x",
        }),
      },
      migrationDraftBatch: { findMany: async () => [] },
      product: { count: async () => 0 },
      transaction: { count: async () => 0 },
    };
    const svc = makeService(prisma);
    await expect(svc.assemble("org-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("assemble rejects when validation fails", async () => {
    const prisma = {
      organization: {
        findFirstOrThrow: async () => ({
          migrationCutoverDate: null,
          migrationAssembledAt: null,
          taxIdBlindIndex: "x",
        }),
        findFirst: async () => ({ migrationAssembledAt: null }),
      },
      migrationDraftBatch: { findMany: async () => [] },
      product: { count: async () => 0 },
      transaction: { count: async () => 0 },
    };
    const svc = makeService(prisma);
    await expect(svc.assemble("org-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("setCutoverDate rejects after assemble", async () => {
    const prisma = {
      organization: {
        findFirst: async () => ({ migrationAssembledAt: new Date() }),
      },
    };
    const svc = makeService(prisma);
    await expect(svc.setCutoverDate("org-1", "2026-01-01")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
