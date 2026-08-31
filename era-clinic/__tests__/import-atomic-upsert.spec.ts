import { z } from "zod";
import { runImportRows } from "@/lib/import/run-import";
import { getImportAdapter } from "@/lib/import/adapters";
import type { ImportAdapter } from "@/lib/import/types";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(async (fn: (tx: { wrapped: boolean }) => Promise<unknown>) =>
      fn({ wrapped: true }),
    ),
  },
}));

describe("import atomic upsert", () => {
  it("marks lab-orders and diagnostics for per-row transactions", () => {
    expect(getImportAdapter("lab-orders")?.atomicUpsert).toBe(true);
    expect(getImportAdapter("diagnostics")?.atomicUpsert).toBe(true);
    expect(getImportAdapter("slots")?.atomicUpsert).toBeFalsy();
  });

  it("runs lab-orders upsert inside prisma.$transaction", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma") as {
      prisma: { $transaction: jest.Mock };
    };
    prisma.$transaction.mockClear();
    const upsert = jest.fn().mockResolvedValue("created");
    const adapter: ImportAdapter<{ externalRef: string }> = {
      entity: "lab-orders",
      label: "Lab orders",
      order: 12,
      atomicUpsert: true,
      templateHint: "test",
      headerAliases: { externalRef: "externalRef" },
      rowSchema: z.object({ externalRef: z.string() }),
      mapRow: (raw) => ({ externalRef: String(raw.externalRef ?? "") }),
      upsert,
    };
    const result = await runImportRows(adapter, [{ externalRef: "wo:lab:1" }], false);
    expect(result.created).toBe(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({ wrapped: true }, { externalRef: "wo:lab:1" }, false);
  });

  it("does not wrap dry-run upserts", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma") as {
      prisma: { $transaction: jest.Mock };
    };
    prisma.$transaction.mockClear();
    const upsert = jest.fn().mockResolvedValue("created");
    const adapter: ImportAdapter<{ externalRef: string }> = {
      entity: "lab-orders",
      label: "Lab orders",
      order: 12,
      atomicUpsert: true,
      templateHint: "test",
      headerAliases: { externalRef: "externalRef" },
      rowSchema: z.object({ externalRef: z.string() }),
      mapRow: (raw) => ({ externalRef: String(raw.externalRef ?? "") }),
      upsert,
    };
    await runImportRows(adapter, [{ externalRef: "wo:lab:1" }], true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(prisma, { externalRef: "wo:lab:1" }, true);
  });
});
