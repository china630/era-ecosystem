import {
  normalizeMedicalPackageCode,
  programCodeForLifecycle,
  resolveAgencyPackageCode,
  resolveMedicalSku,
} from "@/lib/services/medical-package-resolve.service";

describe("medical-package-resolve", () => {
  it("normalizes FO aliases without PKG- prefix", () => {
    expect(normalizeMedicalPackageCode("STANDART")).toBe("PKG-STANDART");
    expect(normalizeMedicalPackageCode("Premium")).toBe("PKG-PREMIUM");
    expect(normalizeMedicalPackageCode("DETOX")).toBe("PKG-DETOKS");
    expect(normalizeMedicalPackageCode("PKG-DERMO")).toBe("PKG-DERMO");
  });

  it("resolves ERA-PKG single line for all pax", () => {
    const r = resolveMedicalSku({
      notes: [{ noteType: "EXTRA_REQ", text: "ERA-PKG STANDART" }],
      agencyName: "Some Agency",
      guests: [{ fullName: "A" }, { fullName: "B" }],
      ratePlanCode: "EW-BAR",
    });
    expect(r.perGuestCodes).toEqual(["PKG-STANDART", "PKG-STANDART"]);
    expect(r.unanimousCode).toBe("PKG-STANDART");
    expect(r.unresolved).toBe(false);
    expect(programCodeForLifecycle(r)).toBe("PKG-STANDART");
  });

  it("ERA-PKG STANDART covers two named guests without listing them", () => {
    const r = resolveMedicalSku({
      notes: [{ noteType: "EXTRA_REQ", text: "ERA-PKG STANDART" }],
      agencyName: null,
      guests: [
        { fullName: "Tünzalə Əliyeva" },
        { fullName: "Elmir Əliyev" },
      ],
    });
    expect(r.perGuestCodes).toEqual(["PKG-STANDART", "PKG-STANDART"]);
    expect(r.unanimousCode).toBe("PKG-STANDART");
  });

  it("identical named SKUs collapse to all pax even when names do not match", () => {
    const r = resolveMedicalSku({
      notes: [
        {
          noteType: "EXTRA_REQ",
          text: "ERA-PKG\nTünzalə Əliyeva: STANDART\nElmir Əliyev: STANDART",
        },
      ],
      agencyName: null,
      guests: [{ fullName: "Guest One" }, { fullName: "Guest Two" }],
    });
    expect(r.perGuestCodes).toEqual(["PKG-STANDART", "PKG-STANDART"]);
    expect(r.unanimousCode).toBe("PKG-STANDART");
  });

  it("ERA-PKG then bare SKU on the next line applies to all pax", () => {
    const r = resolveMedicalSku({
      notes: [{ noteType: "EXTRA_REQ", text: "ERA-PKG\nPREMIUM" }],
      agencyName: null,
      guests: [{ fullName: "A" }, { fullName: "B" }],
    });
    expect(r.unanimousCode).toBe("PKG-PREMIUM");
    expect(r.perGuestCodes).toEqual(["PKG-PREMIUM", "PKG-PREMIUM"]);
  });

  it("resolves named mix from ERA-PKG without ordinals", () => {
    const r = resolveMedicalSku({
      notes: [
        {
          noteType: "EXTRA_REQ",
          text: "ERA-PKG\nAliyev: PREMIUM\nAliyeva: STANDART",
        },
      ],
      agencyName: null,
      guests: [
        { lastName: "Aliyev", firstName: "Ilham" },
        { lastName: "Aliyeva", firstName: "Mehriban" },
      ],
    });
    expect(r.perGuestCodes).toEqual(["PKG-PREMIUM", "PKG-STANDART"]);
    expect(r.unanimousCode).toBeNull();
    expect(r.unresolved).toBe(true);
    expect(programCodeForLifecycle(r)).toBeUndefined();
  });

  it("agency Premium prefix applies to all pax", () => {
    const r = resolveMedicalSku({
      notes: [],
      agencyName: "Premium paket Walkin",
      guests: [{ fullName: "A" }, { fullName: "B" }],
    });
    expect(r.unanimousCode).toBe("PKG-PREMIUM");
  });

  it("agency Dermo / Detox walk-in labels", () => {
    expect(resolveAgencyPackageCode("Dermo paket Walkin")).toBe("PKG-DERMO");
    expect(resolveAgencyPackageCode("Detox paket Walkin")).toBe("PKG-DETOKS");
    expect(resolveAgencyPackageCode("Fecebook Dermo paket")).toBe("PKG-DERMO");
    expect(resolveAgencyPackageCode("Premium Facebook")).toBe("PKG-PREMIUM");
  });

  it("agency token anywhere: Premium/Dermo mid-name", () => {
    expect(resolveAgencyPackageCode("Premium Naftalan Kamel")).toBe("PKG-PREMIUM");
    expect(resolveAgencyPackageCode("Premium Sultan Travel medical")).toBe(
      "PKG-PREMIUM",
    );
    expect(resolveAgencyPackageCode("Dermo Nafdan travel")).toBe("PKG-DERMO");
    expect(resolveAgencyPackageCode("Dermo Naftalanium medical")).toBe("PKG-DERMO");
    expect(resolveAgencyPackageCode("Sanatoriums booking leisure")).toBeNull();
    expect(resolveAgencyPackageCode("Walkin medical")).toBeNull();
  });

  it("Həmkarlar falls back to STANDART when no Extra Req", () => {
    const r = resolveMedicalSku({
      notes: [],
      agencyName: "Həmkarlar Ittifaqi",
      guests: [{ fullName: "Guest" }],
    });
    expect(r.unanimousCode).toBe("PKG-STANDART");
  });

  it("Extra Req ERA-PKG overrides Həmkarlar", () => {
    const r = resolveMedicalSku({
      notes: [{ noteType: "EXTRA_REQ", text: "ERA-PKG PREMIUM" }],
      agencyName: "Hemkarlar",
      guests: [{ fullName: "Guest" }],
    });
    expect(r.unanimousCode).toBe("PKG-PREMIUM");
  });

  it("ignores Channel room-type noise as SKU", () => {
    const r = resolveMedicalSku({
      notes: [
        {
          noteType: "EXTRA_REQ",
          text: "Room Detail(s): Стандартный двухместный",
        },
      ],
      agencyName: null,
      guests: [{ fullName: "Guest" }],
    });
    expect(r.unanimousCode).toBeNull();
    expect(r.unresolved).toBe(true);
  });

  it("Walkin leisure is not a medical SKU", () => {
    expect(resolveAgencyPackageCode("Walkin leisure")).toBeNull();
    const r = resolveMedicalSku({
      notes: [],
      agencyName: "Walkin leisure",
      guests: [{ fullName: "Guest" }],
    });
    expect(r.unresolved).toBe(true);
    expect(r.stayKind).toBe("leisure");
    expect(programCodeForLifecycle(r)).toBeUndefined();
  });

  it("isLeisureAgency helper", async () => {
    const { isLeisureAgency } = await import(
      "@/lib/services/medical-package-resolve.service"
    );
    expect(isLeisureAgency("Walkin leisure")).toBe(true);
    expect(isLeisureAgency("Premium paket Walkin")).toBe(false);
  });

  it("DB agency rules override when provided", () => {
    const r = resolveMedicalSku({
      notes: [],
      agencyName: "Custom Corp Travel",
      guests: [{ fullName: "Guest" }],
      agencyRules: [
        { agencyNamePrefix: "Custom Corp", packageCode: "PKG-DERMO" },
      ],
    });
    expect(r.unanimousCode).toBe("PKG-DERMO");
    expect(r.stayKind).toBe("medical");
  });

  it("Walkin medical without prefix stays unresolved", () => {
    expect(resolveAgencyPackageCode("Walkin medical")).toBeNull();
  });

  it("never uses Rate Code even when present", () => {
    const r = resolveMedicalSku({
      notes: [],
      agencyName: null,
      guests: [{ fullName: "Guest" }],
      ratePlanCode: "PKG-STANDART",
    });
    expect(r.unanimousCode).toBeNull();
  });

  it("unstructured Dermo paket in Extra Req", () => {
    const r = resolveMedicalSku({
      notes: [{ noteType: "EXTRA_REQ", text: "Dermo paket 10 nights" }],
      agencyName: null,
      guests: [{ fullName: "Guest" }],
    });
    expect(r.unanimousCode).toBe("PKG-DERMO");
  });
});
