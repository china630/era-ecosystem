jest.mock("@/lib/prisma", () => ({
  prisma: {
    visit: { findUnique: jest.fn() },
    visitDiscountAudit: { findMany: jest.fn() },
  },
}));

jest.mock("@/lib/billing-router", () => ({
  resolveBillingTarget: jest.fn(async () => "FINANCE"),
}));

import { prisma } from "@/lib/prisma";
import { buildUnifiedBill } from "@/domain/cashier/cashier-bill.service";

const mocked = prisma as unknown as {
  visit: { findUnique: jest.Mock };
  visitDiscountAudit: { findMany: jest.Mock };
};

describe("buildUnifiedBill", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.visitDiscountAudit.findMany.mockResolvedValue([]);
  });

  it("skips zero package lines and includes positive lab/visit lines", async () => {
    mocked.visit.findUnique.mockResolvedValue({
      id: "v1",
      patientRefId: "p1",
      patientRef: { id: "p1", refCode: "R1", fullName: "Guest" },
      patientOrigin: "IN_HOUSE",
      billingTarget: null,
      completedAt: new Date(),
      reservationId: "res1",
      roomNumber: "101",
      amountNet: 40,
      settledAt: null,
      settlementPendingId: null,
      receipts: [],
      serviceLines: [
        {
          id: "sl0",
          serviceCode: "SANATORIUM-INTAKE",
          description: "Intake",
          amount: 0,
        },
        {
          id: "sl1",
          serviceCode: "EXTRA-VISIT",
          description: "Paid visit",
          amount: 25,
        },
      ],
      labOrders: [
        {
          id: "lo1",
          testCode: "ECG-12",
          amountNet: 40,
          items: [
            { id: "li0", serviceCode: "ECG-12", amountNet: 0 },
            { id: "li1", serviceCode: "LAB-CBC", amountNet: 15 },
          ],
        },
      ],
      procedureOrders: [
        {
          id: "po0",
          procedureCode: "PHYSIO",
          procedureName: "Physio",
          amountNet: 0,
        },
        {
          id: "po1",
          procedureCode: "MASSAGE",
          procedureName: "Massage",
          amountNet: 60,
        },
      ],
    });

    const bill = await buildUnifiedBill("v1");
    expect(bill).not.toBeNull();
    expect(bill!.lines.map((l) => l.serviceCode).sort()).toEqual(
      ["EXTRA-VISIT", "LAB-CBC", "MASSAGE"].sort(),
    );
    expect(bill!.amountGross).toBe(100);
    expect(bill!.lines.every((l) => l.amount > 0)).toBe(true);
  });
});
