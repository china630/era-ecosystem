import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import { CustomsTaxCalculatorService } from "./customs-tax-calculator.service";

describe("CustomsTaxCalculatorService", () => {
  it("applies duty on statistical value then VAT on duty-inclusive base via hub", async () => {
    const dataHub = {
      isEnabled: jest.fn().mockReturnValue(true),
      isoDateBaku: jest.fn().mockReturnValue("2025-06-01"),
      getTariff: jest.fn().mockResolvedValue({
        hsCode: "85",
        dutyRatePercent: 10,
        vatRatePercent: 18,
        excisePercent: 0,
      }),
      getHsMeta: jest.fn(),
    };

    const calc = new CustomsTaxCalculatorService(dataHub as never);
    const out = await calc.computeLines(
      [
        {
          sequenceNumber: 1,
          hsCode: "8501400000",
          description: "Test",
          quantity: 1,
          unit: null,
          unitOfMeasureCode: null,
          weightNetKg: 0,
          weightGrossKg: 0,
          invoiceValue: 1000,
          statisticalValueAzn: 1000,
          portalDutyAzn: null,
          portalVatAzn: null,
        },
      ],
      new Date("2025-06-01T00:00:00.000Z"),
    );

    expect(dataHub.getTariff).toHaveBeenCalledWith("8501400000", "2025-06-01");
    expect(Number(out.totalDuty.toString())).toBeCloseTo(100, 4);
    expect(Number(out.totalVat.toString())).toBeCloseTo(198, 4);
  });

  it("rejects when data-hub is disabled", async () => {
    const dataHub = {
      isEnabled: jest.fn().mockReturnValue(false),
      isoDateBaku: jest.fn(),
      getTariff: jest.fn(),
      getHsMeta: jest.fn(),
    };
    const calc = new CustomsTaxCalculatorService(dataHub as never);
    await expect(
      calc.computeLines([], new Date("2025-06-01T00:00:00.000Z")),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
