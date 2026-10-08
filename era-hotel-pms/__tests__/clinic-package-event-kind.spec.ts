import { clinicPackageEventKind } from "@/lib/integration/guest-lifecycle-events";

describe("clinicPackageEventKind", () => {
  it("uses booking-created before check-in", () => {
    expect(clinicPackageEventKind("OPTION")).toBe("booking");
    expect(clinicPackageEventKind("CONFIRMED")).toBe("booking");
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
