import { NotFoundException } from "@nestjs/common";
import { HsService } from "../src/registry/hs/hs.service";
import type { DataSourceService } from "../src/prisma/data-source.service";

describe("Data Hub HS negative paths (AC-DH-HS)", () => {
  it("getHs throws HS_NOT_FOUND for unknown code", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const ds = {
      referenceDb: () => ({
        customsTariffRate: { findFirst },
      }),
    } as unknown as DataSourceService;
    const hs = new HsService(ds);

    await expect(hs.getHs("99999999")).rejects.toBeInstanceOf(NotFoundException);
    try {
      await hs.getHs("99999999");
    } catch (err) {
      const body = (err as NotFoundException).getResponse() as {
        code: string;
        message: string;
      };
      expect(body.code).toBe("HS_NOT_FOUND");
      expect(body.message).toMatch(/HS 99999999 not found/);
    }
  });

  it("getTariff throws TARIFF_NOT_FOUND when no effective row", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const ds = {
      referenceDb: () => ({
        customsTariffRate: { findFirst },
      }),
    } as unknown as DataSourceService;
    const hs = new HsService(ds);

    try {
      await hs.getTariff("0101", "2026-01-01");
      fail("expected NotFoundException");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      const body = (err as NotFoundException).getResponse() as { code: string };
      expect(body.code).toBe("TARIFF_NOT_FOUND");
    }
  });
});
