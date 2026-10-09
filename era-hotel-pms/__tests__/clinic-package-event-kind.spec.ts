import { clinicPackageEventKind } from "@/lib/integration/guest-lifecycle-events";

describe("clinicPackageEventKind", () => {
  it("stays quiet until check-in", () => {
    expect(clinicPackageEventKind("OPTION")).toBe("none");
    expect(clinicPackageEventKind("CONFIRMED")).toBe("none");
  });

  it("uses stay-product only after check-in", () => {
    expect(clinicPackageEventKind("IN_HOUSE")).toBe("stay-product");
  });

  it("stays quiet once the reservation is closed", () => {
    expect(clinicPackageEventKind("CHECKED_OUT")).toBe("none");
    expect(clinicPackageEventKind("CANCELLED")).toBe("none");
    expect(clinicPackageEventKind("NO_SHOW")).toBe("none");
  });
});
