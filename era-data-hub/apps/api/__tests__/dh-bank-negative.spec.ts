import { validateAzIban } from "../src/registry/iban/iban.util";

describe("Data Hub BANK negative paths (AC-DH-BANK)", () => {
  it("rejects empty IBAN", () => {
    const result = validateAzIban("   ");
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("IBAN is empty");
  });

  it("rejects non-AZ or wrong-length IBAN", () => {
    const result = validateAzIban("DE89370400440532013000");
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/AZ IBAN must start with AZ/);
  });

  it("rejects AZ IBAN that fails MOD-97 checksum", () => {
    // Same length as a valid AZ IBAN but last digit flipped → MOD-97 fail
    const result = validateAzIban("AZ21NABZ00000000137010001945");
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/checksum failed/);
  });
});
