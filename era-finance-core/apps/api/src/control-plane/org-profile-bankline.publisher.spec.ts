import { formatOrgBankLine } from "./org-profile-bankline.publisher";

describe("formatOrgBankLine", () => {
  it("matches invoice print bank line shape", () => {
    expect(
      formatOrgBankLine({
        bankName: "Kapital",
        accountNumber: null,
        currency: "AZN",
        iban: "AZ00XXXX",
        swift: "XXXXAZ22",
      }),
    ).toBe("Kapital · AZN · IBAN AZ00XXXX · SWIFT XXXXAZ22");
  });

  it("returns null for empty account", () => {
    expect(formatOrgBankLine(null)).toBeNull();
  });
});
