import { BadRequestException } from "@nestjs/common";
import { FxService } from "../src/registry/fx/fx.service";
import type { DataSourceService } from "../src/prisma/data-source.service";

describe("Data Hub FX negative paths (AC-DH-FX)", () => {
  it("convert throws RATE_NOT_FOUND when no FINAL CBAR rate", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const ds = {
      referenceDb: () => ({
        cbarOfficialRate: { findUnique },
      }),
    } as unknown as DataSourceService;
    const fx = new FxService(ds, { getFxDashboardCurrencyCodes: async () => ["USD"], getFxCbarCheckCurrencyCodes: async () => ["USD"] } as never);

    await expect(fx.convert("USD", "AZN", "10", "2026-01-15")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    try {
      await fx.convert("USD", "AZN", "10", "2026-01-15");
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as {
        code: string;
        message: string;
      };
      expect(body.code).toBe("RATE_NOT_FOUND");
      expect(body.message).toMatch(/No FINAL rate for USD/);
    }
  });

  it("rates without fallback stays empty when the date has no FINAL row", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const findFirst = jest.fn();
    const ds = {
      referenceDb: () => ({ cbarOfficialRate: { findMany, findFirst } }),
    } as unknown as DataSourceService;
    const fx = new FxService(ds, {} as never);
    const body = await fx.getRates("2026-10-31", "USD", undefined);
    expect(body.rates).toEqual([]);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("rates fallback=previous returns the latest earlier FINAL day", async () => {
    const prior = new Date("2026-10-30T12:00:00.000Z");
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          currencyCode: "USD",
          value: 1.7,
          nominal: 1,
          rate: 1.7,
          status: "FINAL",
          rateDate: prior,
        },
      ]);
    const findFirst = jest.fn().mockResolvedValue({ rateDate: prior });
    const ds = {
      referenceDb: () => ({ cbarOfficialRate: { findMany, findFirst } }),
    } as unknown as DataSourceService;
    const fx = new FxService(ds, {} as never);
    const body = await fx.getRates("2026-10-31", "USD", "previous");
    expect(body.rates).toEqual([
      expect.objectContaining({ currencyCode: "USD", rate: 1.7, rateDate: "2026-10-30", status: "FINAL" }),
    ]);
  });

  it("convert rejects non-numeric amount", async () => {
    const ds = {
      referenceDb: () => ({ cbarOfficialRate: { findUnique: jest.fn() } }),
    } as unknown as DataSourceService;
    const fx = new FxService(ds, { getFxDashboardCurrencyCodes: async () => ["USD"], getFxCbarCheckCurrencyCodes: async () => ["USD"] } as never);
    try {
      await fx.convert("USD", "AZN", "not-a-number", undefined);
      fail("expected BadRequestException");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as { code: string };
      expect(body.code).toBe("INVALID_AMOUNT");
    }
  });
});
