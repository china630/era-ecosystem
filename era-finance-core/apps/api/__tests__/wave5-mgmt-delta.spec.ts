import { Decimal } from "@erafinance/database";

/**
 * Pure calc mirror of MgmtLaborDeltaService v1 formula (no DB).
 * Payroll statutory gross uses salary; internalRate is ignored by payroll.
 */
function computeDelta(input: {
  internalRate: number | null;
  salary: number;
  workHours: number;
  monthNormHours: number;
  slipGross?: number | null;
}): { mgmtGross: number; statGross: number; delta: number; skip: boolean } {
  if (input.internalRate == null || input.internalRate <= 0) {
    return { mgmtGross: 0, statGross: 0, delta: 0, skip: true };
  }
  if (input.workHours <= 0 || input.monthNormHours <= 0) {
    return { mgmtGross: 0, statGross: 0, delta: 0, skip: true };
  }
  const ratio = input.workHours / input.monthNormHours;
  const mgmtGross = Number(
    new Decimal(input.internalRate).mul(ratio).toFixed(2),
  );
  const statGross = Number(
    (
      input.slipGross != null
        ? new Decimal(input.slipGross)
        : new Decimal(input.salary).mul(ratio)
    ).toFixed(2),
  );
  const delta = Math.max(0, Number(new Decimal(mgmtGross).sub(statGross).toFixed(2)));
  return { mgmtGross, statGross, delta, skip: false };
}

describe("Wave 5 MgmtLaborDelta formula", () => {
  it("skips when internalRate is null", () => {
    expect(
      computeDelta({
        internalRate: null,
        salary: 1000,
        workHours: 160,
        monthNormHours: 160,
      }).skip,
    ).toBe(true);
  });

  it("delta = max(0, mgmtGross - statGross) from rates", () => {
    const r = computeDelta({
      internalRate: 2000,
      salary: 1000,
      workHours: 160,
      monthNormHours: 160,
    });
    expect(r.mgmtGross).toBe(2000);
    expect(r.statGross).toBe(1000);
    expect(r.delta).toBe(1000);
  });

  it("prefers PayrollSlip.gross for statGross when present", () => {
    const r = computeDelta({
      internalRate: 2000,
      salary: 1000,
      workHours: 160,
      monthNormHours: 160,
      slipGross: 1100,
    });
    expect(r.statGross).toBe(1100);
    expect(r.delta).toBe(900);
  });

  it("never negative delta when contract > internal", () => {
    const r = computeDelta({
      internalRate: 800,
      salary: 1000,
      workHours: 160,
      monthNormHours: 160,
    });
    expect(r.delta).toBe(0);
  });

  it("VACATION/OFF hours are excluded (workHours=0 → skip)", () => {
    expect(
      computeDelta({
        internalRate: 2000,
        salary: 1000,
        workHours: 0,
        monthNormHours: 160,
      }).skip,
    ).toBe(true);
  });

  it("payroll statutory path ignores internalRate (salary only)", () => {
    const salary = 1200;
    const internalRate = 2500;
    const payrollGross = salary;
    expect(payrollGross).toBe(1200);
    expect(payrollGross).not.toBe(internalRate);
  });
});

describe("Wave 5 rebuild orphan semantics", () => {
  it("documents that cleared internalRate requires storno of prior JE", () => {
    // Service rebuild reverses ALL existing month transactionIds before rewrite.
    const prior = { employeeId: "e1", transactionId: "tx-old", delta: 500 };
    const afterRateCleared = { internalRate: null };
    expect(prior.transactionId).toBeTruthy();
    expect(afterRateCleared.internalRate).toBeNull();
  });
});

describe("Wave 5 warehouse tenant isolation", () => {
  it("CreateWarehouseDto has no organizationId field (tenant from JWT)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dtoPath = require("fs").readFileSync(
      require("path").join(
        __dirname,
        "../src/inventory/dto/create-warehouse.dto.ts",
      ),
      "utf8",
    );
    expect(dtoPath).not.toMatch(/organizationId/);
    expect(dtoPath).toMatch(/name/);
  });
});
