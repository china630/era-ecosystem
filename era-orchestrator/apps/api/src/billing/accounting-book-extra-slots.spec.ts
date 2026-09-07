jest.mock("@era365/database", () => ({
  hasCashBankModuleInList: jest.fn(),
  isLegacyCashBankModuleKey: jest.fn().mockReturnValue(false),
  isPassThroughCatalogModuleKey: jest.fn().mockReturnValue(false),
  PRICING_MODULE_CASH_BANK_PRO: "cash_bank_pro",
}));

import { catalogModuleKeyToPatch } from "./billing-module-toggle.helpers";

describe("accounting_book_extra stackable slots", () => {
  it("writes the requested quantity between one and seven", () => {
    expect(
      catalogModuleKeyToPatch("accounting_book_extra", true, 4),
    ).toEqual({
      accounting_book_extra: true,
      accountingBookExtraSlots: 4,
    });
  });

  it("defaults enable to one and disable to zero", () => {
    expect(
      catalogModuleKeyToPatch("accounting_book_extra", true),
    ).toMatchObject({ accountingBookExtraSlots: 1 });
    expect(
      catalogModuleKeyToPatch("accounting_book_extra", false, 7),
    ).toMatchObject({ accountingBookExtraSlots: 0 });
  });
});
