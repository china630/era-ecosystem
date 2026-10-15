import assert from "node:assert/strict";
import test from "node:test";
import {
  clinicProcedureTicketRef,
  fnbTicketLineRef,
  parseFolioChargeRef,
  retailPendingLineRef,
  retailPrescriptionRef,
  retailReceiptLineRef,
  retailReturnLineRef,
  retailRoomReturnRef,
} from "./folio-charge-ref";

test("clinic ticket ref is stable and ignores a pay prefix on read", () => {
  const ref = clinicProcedureTicketRef("ord1");
  assert.equal(ref, "clinic-ticket-ord1");
  assert.deepEqual(parseFolioChargeRef(ref), {
    source: "clinic",
    orderId: "ord1",
    ref,
  });
  assert.equal(parseFolioChargeRef(`pay-${ref}`)?.ref, ref);
  assert.equal(parseFolioChargeRef("pay-clinic-ticket-ord1")?.orderId, "ord1");
});

test("fnb, retail, and prescription refs keep their stored spelling", () => {
  assert.equal(fnbTicketLineRef("t1", "l1"), "t1:l1");
  assert.equal(parseFolioChargeRef("t1:l1")?.source, "fnb");
  assert.equal(retailReceiptLineRef("r1", "l1"), "r1:l1");
  assert.equal(retailPendingLineRef("r1", "l1"), "retail-r1-l1");
  assert.equal(retailReturnLineRef("r1", "l1"), "retail-return-r1-l1");
  assert.equal(retailRoomReturnRef("r1", "l1"), "return:r1:l1");
  assert.equal(parseFolioChargeRef("return:r1:l1")?.source, "retail-return");
  assert.equal(retailPrescriptionRef("s1", "SKU", true), "rx-return:s1:SKU");
  assert.equal(parseFolioChargeRef("rx:s1:SKU")?.source, "retail-prescription");
});
