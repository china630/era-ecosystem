import {
  clinicLabTicketRef,
  clinicProcedureTicketRef,
  clinicVisitTicketRef,
  parseFolioChargeRef,
} from "@era/satellite-kit/integration/folio-charge-ref";

describe("diagnostics folio ticket refs", () => {
  it("keeps lab and visit keys off the procedure clinic-ticket prefix", () => {
    expect(clinicProcedureTicketRef("p1")).toBe("clinic-ticket-p1");
    expect(clinicLabTicketRef("l1")).toBe("lab-ticket-l1");
    expect(clinicVisitTicketRef("v1")).toBe("visit-ticket-v1");
    expect(parseFolioChargeRef("lab-ticket-l1")).toEqual({
      source: "clinic-lab",
      orderId: "l1",
      ref: "lab-ticket-l1",
    });
    expect(parseFolioChargeRef("visit-ticket-v1")).toEqual({
      source: "clinic-visit",
      visitId: "v1",
      ref: "visit-ticket-v1",
    });
  });
});
