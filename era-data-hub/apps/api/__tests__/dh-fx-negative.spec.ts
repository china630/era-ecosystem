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
    const fx = new FxService(ds);

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

  it("convert rejects non-numeric amount", async () => {
    const ds = {
      referenceDb: () => ({ cbarOfficialRate: { findUnique: jest.fn() } }),
    } as unknown as DataSourceService;
    const fx = new FxService(ds);
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
