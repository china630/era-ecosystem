import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AuditHubCalculationService } from "../../src/audit-hub/audit-hub-calculation.service";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("AuditHubCalculationService", () => {
  const org = "00000000-0000-0000-0000-000000000099";

  it("rejects fx_snapshot after local CbarOfficialRate drop", async () => {
    const rateId = "00000000-0000-0000-0000-0000000000aa";
    const mod = await Test.createTestingModule({
      providers: [
        AuditHubCalculationService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    const svc = mod.get(AuditHubCalculationService);
    await expect(svc.explain(org, "fx_snapshot", rateId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("returns depreciation month for fixed_asset_depreciation", async () => {
    const depId = "00000000-0000-0000-0000-0000000000cc";
    const prisma = {
      fixedAssetDepreciationMonth: {
        findFirst: jest.fn().mockResolvedValue({
          id: depId,
          year: 2024,
          month: 3,
          amount: { toString: () => "150.25" },
          transactionId: "tx-dep-1",
          fixedAsset: {
            id: "fa1",
            name: "Laptop",
            inventoryNumber: "INV-1",
            purchasePrice: { toString: () => "5000" },
            usefulLifeMonths: 36,
            depreciationMethod: "STRAIGHT_LINE",
          },
        }),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        AuditHubCalculationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const svc = mod.get(AuditHubCalculationService);
    const out = await svc.explain(org, "fixed_asset_depreciation", depId);
    expect(out.type).toBe("fixed_asset_depreciation");
    expect((out.summary as { fixedAsset?: { name?: string } }).fixedAsset?.name).toBe("Laptop");
  });

  it("returns payroll run aggregates for payroll_accrual", async () => {
    const runId = "00000000-0000-0000-0000-0000000000bb";
    const prisma = {
      payrollRun: {
        findFirst: jest.fn().mockResolvedValue({
          id: runId,
          year: 2024,
          month: 4,
          status: "POSTED",
          transactionId: "tx1",
          timesheetId: null,
          _count: { slips: 3 },
        }),
      },
      payrollSlip: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            gross: { toString: () => "9000" },
            net: { toString: () => "7200" },
            incomeTax: { toString: () => "900" },
            dsmfEmployer: { toString: () => "400" },
            itsEmployer: { toString: () => "100" },
          },
        }),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        AuditHubCalculationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const svc = mod.get(AuditHubCalculationService);
    const out = await svc.explain(org, "payroll_accrual", runId);
    expect(out.type).toBe("payroll_accrual");
    expect((out.summary as { slipCount?: number }).slipCount).toBe(3);
    expect(prisma.payrollSlip.aggregate).toHaveBeenCalled();
  });
});
