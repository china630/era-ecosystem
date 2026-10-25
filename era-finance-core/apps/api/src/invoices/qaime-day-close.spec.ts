import { invoiceHoldsDayForMissingEqaime, manualEqaimeLinkPatch } from "./qaime-day-close";
import { HttpException } from "@nestjs/common";
import { EqaimeSubmissionService } from "./eqaime-submission.service";

const legal = {
  status: "SENT",
  isInternational: false,
  currency: "AZN",
  counterpartyKind: "LEGAL_ENTITY",
  isVatPayer: false,
  hasTaxId: true,
  eqaimeNumber: null,
};

describe("e-qaimə day close", () => {
  it("does not hold the day when the number is missing and the buyer is the population", () => {
    expect(
      invoiceHoldsDayForMissingEqaime({
        ...legal,
        counterpartyKind: "INDIVIDUAL",
        isVatPayer: false,
        hasTaxId: false,
      }),
    ).toBe(false);
  });

  it("holds the day for a registered invoice without a number", () => {
    expect(invoiceHoldsDayForMissingEqaime(legal)).toBe(true);
    expect(invoiceHoldsDayForMissingEqaime({ ...legal, eqaimeNumber: "   " })).toBe(true);
  });

  it("does not hold the day after a number is linked by hand", () => {
    expect(invoiceHoldsDayForMissingEqaime({ ...legal, eqaimeNumber: "QA-9" })).toBe(false);
  });

  it("stores a manual number without a gateway submission", () => {
    expect(manualEqaimeLinkPatch(" QA-9 ")).toEqual({
      eqaimeNumber: "QA-9",
      eqaimeStatus: "MANUAL",
    });
  });
});

describe("manual e-qaimə link", () => {
  function build(flag: string) {
    const adapterSubmit = jest.fn();
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: "inv",
          status: "SENT",
          isInternational: false,
          currency: "AZN",
          eqaimeNumber: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const svc = new EqaimeSubmissionService(
      prisma as never,
      {} as never,
      { get: () => ({ submit: adapterSubmit }) } as never,
      {} as never,
      { get: () => flag } as never,
    );
    return { svc, adapterSubmit };
  }

  it("does not call the gateway when linking a number", async () => {
    const { svc, adapterSubmit } = build("0");
    const linked = await svc.linkManual("org", "inv", "QA-9");
    expect(linked.submitted).toBe(false);
    expect(linked.eqaimeNumber).toBe("QA-9");
    expect(adapterSubmit).not.toHaveBeenCalled();
  });

  it("still answers 503 on submit while S2S is off", async () => {
    const { svc, adapterSubmit } = build("0");
    try {
      await svc.submit("org", "inv");
      throw new Error("submit should refuse");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(503);
    }
    expect(adapterSubmit).not.toHaveBeenCalled();
  });
});
