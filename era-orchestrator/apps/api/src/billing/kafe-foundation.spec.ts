import { shouldWaiveEraFoundation, applyCatalogMutex } from "@era365/database";

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

  it("XOR QR menu vs client portal", () => {
    const keys = applyCatalogMutex(
      ["fnb_qr_menu", "platform_portal"],
      "platform_portal",
    );
    expect(keys).toEqual(["platform_portal"]);
  });
});
