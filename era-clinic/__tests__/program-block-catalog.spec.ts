import {
  CUSTOM_QUERY_MIN,
  filterCustomSkus,
  filterTreatmentSkus,
  fulfillmentFromKind,
  treatmentFamily,
} from "@/domain/sanatorium/program-block-catalog";

describe("program-block-catalog", () => {
  it("derives fulfillment from kind (İcra is not a separate admin axis)", () => {
    expect(fulfillmentFromKind("PHYSIO")).toBe("PROCEDURE_ORDER");
    expect(fulfillmentFromKind("BATH")).toBe("PROCEDURE_ORDER");
    expect(fulfillmentFromKind("PARAFFIN")).toBe("PROCEDURE_ORDER");
    expect(fulfillmentFromKind("CUSTOM")).toBe("PROCEDURE_ORDER");
    expect(fulfillmentFromKind("LAB")).toBe("LAB_ORDER");
    expect(fulfillmentFromKind("EXAM")).toBe("VISIT");
    expect(fulfillmentFromKind(null)).toBe("PROCEDURE_ORDER");
  });

  it("splits treatment SKUs into paraffin / bath / physio families", () => {
    expect(treatmentFamily("SVC-PARAFIN", "Parafin")).toBe("PARAFFIN");
    expect(treatmentFamily("SVC-NAFTALAN-VANNASI-KISI", "Naftalan vannası")).toBe(
      "BATH",
    );
    expect(treatmentFamily("SVC-OZONTERAPIYA", "Ozonterapiya")).toBe("PHYSIO");

    const types = [
      { code: "PHYSIO_POOL", name: "Pool" },
      { code: "SVC-PARAFIN", name: "Parafin" },
      { code: "SVC-NAFTALAN-VANNASI-QADIN", name: "Naftalan vannası" },
      { code: "SVC-OZONTERAPIYA", name: "Ozon" },
    ];
    expect(filterTreatmentSkus("PARAFFIN", types).map((t) => t.code)).toEqual([
      "SVC-PARAFIN",
    ]);
    expect(filterTreatmentSkus("BATH", types).map((t) => t.code)).toEqual([
      "SVC-NAFTALAN-VANNASI-QADIN",
    ]);
    expect(filterTreatmentSkus("PHYSIO", types).map((t) => t.code)).toEqual([
      "SVC-OZONTERAPIYA",
    ]);
  });

  it("does not dump the custom catalog until the query is long enough", () => {
    const types = [
      { code: "LAB-CBC", name: "Complete blood count" },
      { code: "SVC-OZONTERAPIYA", name: "Ozon" },
    ];
    expect(filterCustomSkus("c", types)).toEqual([]);
    expect(CUSTOM_QUERY_MIN).toBe(2);
    expect(filterCustomSkus("cb", types).map((t) => t.code)).toEqual(["LAB-CBC"]);
    expect(filterCustomSkus("ozon", types).map((t) => t.code)).toEqual([
      "SVC-OZONTERAPIYA",
    ]);
  });
});
