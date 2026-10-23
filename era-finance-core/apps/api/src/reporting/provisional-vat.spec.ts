import { ConflictException } from "@nestjs/common";
import { SchemePeriodService } from "./scheme-period.service";
import { amendmentBlocksClose, decideSchemeRecalc } from "./scheme-period-recalc";
import {
  adjustmentMovesCash,
  creditAdjustmentLines,
  purchaseVatLines,
  salesVatPercent,
} from "./provisional-vat";

const codes = {
  inventoryCode: "201",
  expenseCode: "731",
  vatInputCode: "191",
  payableCode: "531",
};

describe("provisional input VAT", () => {
  it("posts the whole purchase to expense and skips inventory and 191 while the document is missing", () => {
    const services = purchaseVatLines({
      pricesIncludeVat: true,
      hasTaxDocument: false,
      netGoods: "0.00",
      netServices: "100.00",
      vat: "18.00",
      gross: "118.00",
      ...codes,
    });
    expect(services.waitingDocument).toBe(true);
    expect(services.lines.map((line) => line.accountCode)).not.toContain("191");
    expect(services.lines.map((line) => line.accountCode)).not.toContain("201");
    expect(services.lines).toEqual([
      { accountCode: "731", debit: "118.00", credit: "0.00" },
      { accountCode: "531", debit: "0.00", credit: "118.00" },
    ]);

    const goods = purchaseVatLines({
      pricesIncludeVat: true,
      hasTaxDocument: false,
      netGoods: "100.00",
      netServices: "0.00",
      vat: "18.00",
      gross: "118.00",
      ...codes,
    });
    expect(goods.lines).toEqual([
      { accountCode: "731", debit: "118.00", credit: "0.00" },
      { accountCode: "531", debit: "0.00", credit: "118.00" },
    ]);
    expect(goods.netGoods).toBe("100.00");
  });

  it("posts 191 when the act or e-qaimə is already known", () => {
    const posted = purchaseVatLines({
      pricesIncludeVat: true,
      hasTaxDocument: true,
      netGoods: "100.00",
      netServices: "0.00",
      vat: "18.00",
      gross: "118.00",
      ...codes,
    });
    expect(posted.waitingDocument).toBe(false);
    expect(posted.lines).toContainEqual({ accountCode: "191", debit: "18.00", credit: "0.00" });
  });

  it("moves the tax onto 191 and closes it against output VAT without a cash line", () => {
    const lines = creditAdjustmentLines({
      vat: "18",
      netGoods: "100.00",
      expenseCode: "731",
      inventoryCode: "201",
      vatInputCode: "191",
      vatOutputCode: "545",
    });
    expect(lines).toContainEqual({ accountCode: "201", debit: "100.00", credit: "0.00" });
    expect(lines.some((line) => line.accountCode === "191")).toBe(true);
    expect(lines.some((line) => line.accountCode === "545")).toBe(true);
    expect(adjustmentMovesCash(lines, ["101", "223"])).toBe(false);
  });

  it("keeps the scheme rate and refuses a later exemption", () => {
    expect(salesVatPercent({ schemeVatPercent: "18", exemptionChecked: false })).toBe("18");
    expect(() => salesVatPercent({ schemeVatPercent: "18", exemptionChecked: true })).toThrow(
      /exemption/,
    );
  });
});

describe("filed period recalculation", () => {
  it("recalculates a downloaded declaration in place", () => {
    expect(
      decideSchemeRecalc({
        status: "GENERATED",
        previousAmount: "20.00",
        nextAmount: "18.00",
        retroactive: false,
      }).kind,
    ).toBe("recalculate");
    expect(
      decideSchemeRecalc({
        status: "UPLOADED",
        previousAmount: "20.00",
        nextAmount: "18.00",
        retroactive: false,
      }).kind,
    ).toBe("recalculate");
  });

  it("keeps a confirmed amount and drafts only the difference", () => {
    const decision = decideSchemeRecalc({
      status: "CONFIRMED_BY_TAX",
      previousAmount: "20.00",
      nextAmount: "12.00",
      retroactive: false,
    });
    expect(decision).toEqual({
      kind: "amendment",
      previous: "20.00",
      next: "12.00",
      delta: "-8.00",
    });
  });

  it("does not raise a filed tax when the new norm has no retroactive force", () => {
    expect(
      decideSchemeRecalc({
        status: "CONFIRMED_BY_TAX",
        previousAmount: "20.00",
        nextAmount: "24.00",
        retroactive: false,
      }),
    ).toEqual({ kind: "keep_filed", previous: "20.00", next: "24.00" });
  });

  it("blocks the next month while the draft is unsent", () => {
    expect(amendmentBlocksClose([{ status: "DRAFT", period: "2026-05" }], "2026-06")).toBe(true);
    expect(amendmentBlocksClose([{ status: "SENT", period: "2026-05" }], "2026-06")).toBe(false);
    expect(amendmentBlocksClose([{ status: "DRAFT", period: "2026-Q2" }], "2026-07")).toBe(true);
    expect(amendmentBlocksClose([{ status: "DRAFT", period: "2026-Q2" }], "2026-06")).toBe(false);
    expect(amendmentBlocksClose([{ status: "DRAFT", period: "2026" }], "2027-01")).toBe(true);
    expect(amendmentBlocksClose([{ status: "DRAFT", period: "2026" }], "2026-12")).toBe(false);
  });

  it("writes the open amount from the scheme and leaves a confirmed export untouched", async () => {
    const update = jest.fn();
    const upsert = jest.fn();
    const recomputedAmount = jest
      .fn()
      .mockResolvedValueOnce({ amount: "18.00", retroactive: false })
      .mockResolvedValueOnce({ amount: "12.00", retroactive: false })
      .mockResolvedValueOnce({ amount: "24.00", retroactive: false });
    const prisma = {
      taxDeclarationExport: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: "export-1", status: "GENERATED", amountAzn: "20.00" })
          .mockResolvedValueOnce({ id: "export-1", status: "CONFIRMED_BY_TAX", amountAzn: "20.00" })
          .mockResolvedValueOnce({ id: "export-1", status: "CONFIRMED_BY_TAX", amountAzn: "20.00" }),
        update,
      },
      taxAmendmentDraft: { upsert, findMany: jest.fn() },
    };
    const svc = new SchemePeriodService(prisma as never, { recomputedAmount } as never);
    const open = await svc.apply("org-1", { period: "2026-05", taxType: "SIMPLIFIED_TAX" });
    expect(open.decision.kind).toBe("recalculate");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { previousAmountAzn: "20.00", amountAzn: "18.00" },
      }),
    );
    expect(upsert).not.toHaveBeenCalled();

    update.mockClear();
    const filed = await svc.apply("org-1", { period: "2026-05", taxType: "SIMPLIFIED_TAX" });
    expect(filed.exportAmountUnchanged).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalled();

    update.mockClear();
    upsert.mockClear();
    const kept = await svc.apply("org-1", { period: "2026-05", taxType: "SIMPLIFIED_TAX" });
    expect(kept.decision.kind).toBe("keep_filed");
    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps a confirmed amount when the scheme tax is higher and the norm is not retroactive", async () => {
    const update = jest.fn();
    const upsert = jest.fn();
    const prisma = {
      taxDeclarationExport: {
        findFirst: jest.fn().mockResolvedValue({
          id: "export-1",
          status: "CONFIRMED_BY_TAX",
          amountAzn: "20.00",
        }),
        update,
      },
      taxAmendmentDraft: { upsert },
    };
    const svc = new SchemePeriodService(prisma as never, {
      recomputedAmount: jest.fn().mockResolvedValue({ amount: "24.00", retroactive: false }),
    } as never);
    const out = await svc.apply("org-1", { period: "2026-05", taxType: "SIMPLIFIED_TAX" });
    expect(out.decision.kind).toBe("keep_filed");
    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses closePeriod while an earlier draft is not marked sent", async () => {
    const prisma = {
      taxAmendmentDraft: {
        findMany: jest.fn().mockResolvedValue([{ status: "DRAFT", period: "2026-05" }]),
      },
    };
    const svc = new SchemePeriodService(prisma as never);
    await expect(svc.assertCloseAllowed("org-1", "2026-06")).rejects.toBeInstanceOf(ConflictException);
    try {
      await svc.assertCloseAllowed("org-1", "2026-06");
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: "TAX_AMENDMENT_UNSENT",
      });
    }
  });
});
