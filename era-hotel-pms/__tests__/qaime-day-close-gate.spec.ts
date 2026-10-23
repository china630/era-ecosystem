import {
  assertQaimeDayClose,
  fetchQaimeDayClose,
  QaimeDayCloseBlockedError,
  QaimeDayCloseUnreachableError,
} from "../src/lib/services/qaime-day-close-gate";

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org-1",
}));

const gap = { id: "inv-1", number: "INV-1", counterpartyName: "Acme" };

describe("hotel e-qaimə day close", () => {
  it("lets the audit continue when the org rule is off, even without a number", () => {
    expect(() => assertQaimeDayClose({ enabled: false, gaps: [gap] })).not.toThrow();
  });

  it("refuses the audit when a registered invoice has no number", () => {
    expect(() => assertQaimeDayClose({ enabled: true, gaps: [gap] })).toThrow(QaimeDayCloseBlockedError);
  });

  it("lets the audit continue when every registered invoice has a number", () => {
    expect(() => assertQaimeDayClose({ enabled: true, gaps: [] })).not.toThrow();
  });

  it("refuses the audit when finance does not answer", async () => {
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "token";
    const fetchImpl = jest.fn().mockRejectedValue(new Error("down"));
    await expect(fetchQaimeDayClose("2026-10-24", fetchImpl)).rejects.toBeInstanceOf(
      QaimeDayCloseUnreachableError,
    );
  });
});
