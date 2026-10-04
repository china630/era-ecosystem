import { applyCatalogMutex, isKafeEdition, shouldWaiveEraFoundation } from "@era365/database";

describe("Kafe Foundation waiver + QR XOR", () => {
  it("waives Foundation without NAS", () => {
    expect(
      shouldWaiveEraFoundation({
        subscriptionPlan: "kafe",
        activeModules: ["industry_fnb_pos"],
      }),
    ).toBe(true);
  });

  it("keeps Foundation when NAS is on", () => {
    expect(
      shouldWaiveEraFoundation({
        subscriptionPlan: "kafe",
        activeModules: ["nas"],
      }),
    ).toBe(false);
  });

  it("upgrade to full F&B keeps the waiver and leaves the Kafe edition", () => {
    const upgraded = {
      subscriptionPlan: "fnb",
      settings: { edition: "fnb", signupSource: "kafe", hotelMode: false },
      activeModules: ["industry_fnb_pos"],
    };
    expect(isKafeEdition(upgraded)).toBe(false);
    expect(shouldWaiveEraFoundation(upgraded)).toBe(true);
  });

  it("hotel org is neither Kafe nor waived", () => {
    const hotel = { subscriptionPlan: "pro", settings: {}, activeModules: ["industry_fnb_pos"] };
    expect(isKafeEdition(hotel)).toBe(false);
    expect(shouldWaiveEraFoundation(hotel)).toBe(false);
  });

  it("XOR QR menu vs client portal", () => {
    const keys = applyCatalogMutex(
      ["fnb_qr_menu", "platform_portal"],
      "platform_portal",
    );
    expect(keys).toEqual(["platform_portal"]);
  });
});
