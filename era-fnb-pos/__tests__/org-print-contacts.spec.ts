import { outletToPrintOverlay } from "@/lib/org-print-overlay";

describe("F&B outlet print overlay (CP-ORG-PROFILE-01 Track C)", () => {
  it("maps outlet contact columns to kit overlay shape", () => {
    expect(
      outletToPrintOverlay({
        name: "Bar Yasamal",
        phone: "+994551111111",
        email: "bar@example.com",
        address: "Yasamal",
        website: null,
      }),
    ).toEqual({
      name: "Bar Yasamal",
      phone: "+994551111111",
      email: "bar@example.com",
      address: "Yasamal",
      website: null,
    });
  });

  it("returns null for missing outlet", () => {
    expect(outletToPrintOverlay(null)).toBeNull();
  });
});
