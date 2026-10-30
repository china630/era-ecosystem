import { outletToPrintOverlay } from "@/lib/org-print-overlay";

describe("Retail outlet print overlay (CP-ORG-PROFILE-01 Track C)", () => {
  it("maps outlet contact columns to kit overlay shape", () => {
    expect(
      outletToPrintOverlay({
        name: "Shop 1",
        phone: "+994551111111",
        email: null,
        address: "Nizami",
        website: null,
      }),
    ).toEqual({
      name: "Shop 1",
      phone: "+994551111111",
      email: null,
      address: "Nizami",
      website: null,
    });
  });

  it("returns null for missing outlet", () => {
    expect(outletToPrintOverlay(null)).toBeNull();
  });
});
