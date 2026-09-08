import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  AccountType,
  LedgerType,
  Prisma,
  TransactionMirrorStatus,
} from "@erafinance/database";
import { IfrsAutoMappingService } from "../../src/accounting/ifrs-auto-mapping.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { SubscriptionAccessService } from "../../src/subscription/subscription-access.service";

jest.mock("../../src/subscription/subscription-access.service", () => ({
  SubscriptionAccessService: class SubscriptionAccessService {
    hasModule = jest.fn();
  },
}));

const Decimal = Prisma.Decimal;

describe("IfrsAutoMappingService (P0 integrity + hardening)", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";
  const txId = "00000000-0000-0000-0000-0000000000aa";
  const nasAccId = "00000000-0000-0000-0000-000000000101";
  const ifrsAccId = "00000000-0000-0000-0000-000000000201";
  const jeId = "00000000-0000-0000-0000-000000000301";
  const setId = "00000000-0000-0000-0000-000000000401";
  const lineId = "00000000-0000-0000-0000-000000000501";
  const sourceBookId = "00000000-0000-0000-0000-000000000601";
  const targetBookId = "00000000-0000-0000-0000-000000000602";

  function makeSvc(opts: {
    entitled?: boolean;
    mode?: "soft" | "strict";
    published?: boolean;
    sourceType?: AccountType;
    targetType?: AccountType;
    targetDeleted?: boolean;
    retryEntitled?: boolean;
  }) {
    const mode = opts.mode ?? "soft";
    const published = opts.published ?? true;
    const sourceType = opts.sourceType ?? AccountType.ASSET;
    const targetType = opts.targetType ?? AccountType.ASSET;
    const entitled = opts.entitled ?? true;

    const txUpdate = jest.fn().mockResolvedValue({});
    const journalCreate = jest.fn().mockResolvedValue({ id: "ifrs-je" });
    const journalDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const journalFindFirst = jest.fn().mockResolvedValue(null);

    const publishedSet = published
      ? {
          id: setId,
          code: "NAS_TO_IFRS",
          toBook: { id: targetBookId, gaapKind: "IFRS" },
          lines: [
            {
              id: lineId,
              sourceAccountId: nasAccId,
              targetAccountId: ifrsAccId,
              ratio: new Decimal(1),
              sourceAccount: {
                id: nasAccId,
                code: "211",
                type: sourceType,
                deletedAt: null,
              },
              targetAccount: {
                id: ifrsAccId,
                code: "1200",
                type: targetType,
                deletedAt: opts.targetDeleted ? new Date() : null,
              },
            },
          ],
        }
      : null;
    const tx = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          settings: { ledgerMirror: { mode } },
        }),
      },
      ledgerMappingSet: {
        findFirst: jest.fn().mockResolvedValue(publishedSet),
        findMany: jest.fn().mockResolvedValue(publishedSet ? [publishedSet] : []),
      },
      journalEntry: {
        findFirst: journalFindFirst,
        create: journalCreate,
        deleteMany: journalDeleteMany,
      },
      transaction: {
        update: txUpdate,
        findFirst: jest.fn().mockResolvedValue({
          id: txId,
          mirrorStatus: TransactionMirrorStatus.FAILED,
          journalEntries: [
            {
              id: jeId,
              accountId: nasAccId,
              accountingBookId: sourceBookId,
              ledgerType: LedgerType.NAS,
              debit: new Decimal(100),
              credit: new Decimal(0),
              account: { id: nasAccId, code: "211" },
            },
            {
              id: "00000000-0000-0000-0000-000000000302",
              accountId: nasAccId,
              accountingBookId: sourceBookId,
              ledgerType: LedgerType.NAS,
              debit: new Decimal(0),
              credit: new Decimal(100),
              account: { id: nasAccId, code: "211" },
            },
          ],
        }),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    } as unknown as PrismaService;

    const subscriptionAccess = {
      hasModule: jest
        .fn()
        .mockResolvedValue(opts.retryEntitled ?? entitled),
    } as unknown as SubscriptionAccessService;

    const svc = new IfrsAutoMappingService(prisma, subscriptionAccess);
    return {
      svc,
      tx,
      txUpdate,
      journalCreate,
      journalDeleteMany,
      subscriptionAccess,
      entitled,
    };
  }

  const nasLines = [
    {
      accountId: nasAccId,
      accountCode: "211",
      debit: new Decimal(100),
      credit: new Decimal(0),
      journalEntryId: jeId,
    },
    {
      accountId: nasAccId,
      accountCode: "211",
      debit: new Decimal(0),
      credit: new Decimal(100),
      journalEntryId: "00000000-0000-0000-0000-000000000302",
    },
  ];

  it("entitlement off → NONE, clears IFRS orphans", async () => {
    const { svc, tx, journalCreate, journalDeleteMany, txUpdate } = makeSvc({
      entitled: false,
    });
    const out = await svc.mirrorFromNas({
      tx: tx as never,
      organizationId: orgId,
      transactionId: txId,
      nasLines,
      entitled: false,
    });
    expect(out.status).toBe(TransactionMirrorStatus.NONE);
    expect(journalDeleteMany).toHaveBeenCalled();
    expect(journalCreate).not.toHaveBeenCalled();
    expect(txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mirrorStatus: TransactionMirrorStatus.NONE,
        }),
      }),
    );
  });

  it("soft + no published set → FAILED + clear IFRS", async () => {
    const { svc, tx, journalCreate, journalDeleteMany } = makeSvc({
      entitled: true,
      published: false,
      mode: "soft",
    });
    const out = await svc.mirrorFromNas({
      tx: tx as never,
      organizationId: orgId,
      transactionId: txId,
      nasLines,
      entitled: true,
    });
    expect(out.status).toBe(TransactionMirrorStatus.FAILED);
    expect(out.errorCode).toBe("NO_PUBLISHED_SET");
    expect(journalDeleteMany).toHaveBeenCalled();
    expect(journalCreate).not.toHaveBeenCalled();
  });

  it("strict + no published set → throws", async () => {
    const { svc, tx } = makeSvc({
      entitled: true,
      published: false,
      mode: "strict",
    });
    await expect(
      svc.mirrorFromNas({
        tx: tx as never,
        organizationId: orgId,
        transactionId: txId,
        nasLines,
        entitled: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("full coverage → POSTED with provenance + clears then creates", async () => {
    const { svc, tx, journalCreate, journalDeleteMany } = makeSvc({
      entitled: true,
      published: true,
      mode: "soft",
    });
    const out = await svc.mirrorFromNas({
      tx: tx as never,
      organizationId: orgId,
      transactionId: txId,
      nasLines,
      entitled: true,
    });
    expect(out.status).toBe(TransactionMirrorStatus.POSTED);
    expect(out.mappingSetId).toBe(setId);
    expect(journalDeleteMany).toHaveBeenCalled();
    expect(journalCreate).toHaveBeenCalled();
    expect(journalCreate.mock.calls[0][0].data).toMatchObject({
      ledgerType: LedgerType.IFRS,
      sourceJournalEntryId: jeId,
      mappingLineId: lineId,
    });
  });

  it("mirrors one NAS post into IFRS and MANAGEMENT books", async () => {
    const { svc, tx, journalCreate, txUpdate } = makeSvc({
      entitled: true,
      published: true,
      mode: "soft",
    });
    const ifrsSet = await tx.ledgerMappingSet.findFirst({} as never);
    const managementBookId = "00000000-0000-0000-0000-000000000603";
    const managementSetId = "00000000-0000-0000-0000-000000000402";
    const managementSet = {
      ...ifrsSet,
      id: managementSetId,
      code: "NAS_TO_MGMT",
      toBook: { id: managementBookId, gaapKind: "MANAGEMENT" },
    };
    (tx.ledgerMappingSet.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: setId, code: "NAS_TO_IFRS", toBookId: targetBookId },
        {
          id: managementSetId,
          code: "NAS_TO_MGMT",
          toBookId: managementBookId,
        },
      ])
      .mockResolvedValueOnce([ifrsSet])
      .mockResolvedValueOnce([managementSet]);

    const out = await svc.mirrorFromNas({
      tx: tx as never,
      organizationId: orgId,
      transactionId: txId,
      nasLines,
      sourceBookId,
      entitled: true,
    });

    expect(out.status).toBe(TransactionMirrorStatus.POSTED);
    expect(out.runs).toHaveLength(2);
    expect(journalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountingBookId: targetBookId,
        ledgerType: LedgerType.IFRS,
      }),
    });
    expect(journalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountingBookId: managementBookId,
        ledgerType: LedgerType.MANAGEMENT,
      }),
    });
    expect(txUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mirrorStatus: TransactionMirrorStatus.POSTED,
          mirrorErrorDetail: expect.objectContaining({
            mirrorRuns: expect.arrayContaining([
              expect.objectContaining({ mappingSetId: setId }),
              expect.objectContaining({ mappingSetId: managementSetId }),
            ]),
          }),
        }),
      }),
    );
  });

  it("selects a published non-NAS mapping by source book id", async () => {
    const { svc, tx, journalCreate } = makeSvc({
      entitled: true,
      published: true,
      mode: "soft",
    });
    const customSet = {
      ...(await tx.ledgerMappingSet.findFirst({} as never)),
      code: "MGMT_TO_TAX",
      toBook: { id: targetBookId, gaapKind: "TAX" },
    };
    (tx.ledgerMappingSet.findMany as jest.Mock).mockResolvedValue([customSet]);

    const out = await svc.mirrorFromBook({
      tx: tx as never,
      organizationId: orgId,
      transactionId: txId,
      sourceLines: nasLines,
      sourceBookId,
      sourceLedgerType: LedgerType.MANAGEMENT,
      entitled: true,
    });

    expect(out.mappingSetId).toBe(setId);
    expect(tx.ledgerMappingSet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fromBookId: sourceBookId }),
      }),
    );
    expect(journalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountingBookId: targetBookId,
        ledgerType: LedgerType.MANAGEMENT,
      }),
    });
  });

  it("semantic type mismatch → FAILED soft + clear", async () => {
    const { svc, tx, journalCreate, journalDeleteMany } = makeSvc({
      sourceType: AccountType.ASSET,
      targetType: AccountType.REVENUE,
      mode: "soft",
    });
    const out = await svc.mirrorFromNas({
      tx: tx as never,
      organizationId: orgId,
      transactionId: txId,
      nasLines,
      entitled: true,
    });
    expect(out.status).toBe(TransactionMirrorStatus.FAILED);
    expect(out.errorCode).toBe("SEMANTIC_TYPE_MISMATCH");
    expect(journalDeleteMany).toHaveBeenCalled();
    expect(journalCreate).not.toHaveBeenCalled();
  });

  it("deleted IFRS target → TARGET_ACCOUNT_MISSING", async () => {
    const { svc, tx, journalCreate } = makeSvc({
      targetDeleted: true,
      mode: "soft",
    });
    const out = await svc.mirrorFromNas({
      tx: tx as never,
      organizationId: orgId,
      transactionId: txId,
      nasLines,
      entitled: true,
    });
    expect(out.status).toBe(TransactionMirrorStatus.FAILED);
    expect(out.errorCode).toBe("TARGET_ACCOUNT_MISSING");
    expect(journalCreate).not.toHaveBeenCalled();
  });

  it("missing source coverage → FAILED soft", async () => {
    const { svc, tx, journalCreate } = makeSvc({ published: true });
    const out = await svc.mirrorFromNas({
      tx: tx as never,
      organizationId: orgId,
      transactionId: txId,
      nasLines: [
        {
          accountId: "00000000-0000-0000-0000-000000009999",
          accountCode: "999",
          debit: new Decimal(10),
          credit: new Decimal(0),
          journalEntryId: jeId,
        },
        {
          accountId: "00000000-0000-0000-0000-000000009999",
          accountCode: "999",
          debit: new Decimal(0),
          credit: new Decimal(10),
          journalEntryId: "00000000-0000-0000-0000-000000000302",
        },
      ],
      entitled: true,
    });
    expect(out.status).toBe(TransactionMirrorStatus.FAILED);
    expect(out.errorCode).toBe("MISSING_IFRS_MAPPING");
    expect(journalCreate).not.toHaveBeenCalled();
  });

  it("ratio imbalance → IFRS_UNBALANCED soft", async () => {
    const { svc, tx, journalCreate } = makeSvc({ published: true });
    // Unbalanced NAS input (engine still runs coverage then balance check)
    const out = await svc.mirrorFromNas({
      tx: tx as never,
      organizationId: orgId,
      transactionId: txId,
      nasLines: [
        {
          accountId: nasAccId,
          accountCode: "211",
          debit: new Decimal(100),
          credit: new Decimal(0),
          journalEntryId: jeId,
        },
      ],
      entitled: true,
    });
    expect(out.status).toBe(TransactionMirrorStatus.FAILED);
    expect(out.errorCode).toBe("IFRS_UNBALANCED");
    expect(journalCreate).not.toHaveBeenCalled();
  });

  it("retry without entitlement → Forbidden", async () => {
    const { svc } = makeSvc({ retryEntitled: false });
    await expect(
      svc.retryFailedMirror(orgId, txId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("retry uses org mode (strict) and can abort", async () => {
    const { svc, subscriptionAccess } = makeSvc({
      retryEntitled: true,
      published: false,
      mode: "strict",
    });
    (subscriptionAccess.hasModule as jest.Mock).mockResolvedValue(true);
    await expect(svc.retryFailedMirror(orgId, txId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("retry entitled + soft + published → POSTED", async () => {
    const { svc, journalCreate, subscriptionAccess } = makeSvc({
      retryEntitled: true,
      published: true,
      mode: "soft",
    });
    (subscriptionAccess.hasModule as jest.Mock).mockResolvedValue(true);
    const out = await svc.retryFailedMirror(orgId, txId);
    expect(out.status).toBe(TransactionMirrorStatus.POSTED);
    expect(journalCreate).toHaveBeenCalled();
  });
});
