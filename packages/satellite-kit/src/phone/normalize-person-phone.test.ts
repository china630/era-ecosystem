import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePersonPhone,
  personPhoneDedupDigits,
} from "./normalize-person-phone.js";

test("empty raw → empty", () => {
  const r = normalizePersonPhone({ raw: "  ", nationalityIso: "AZ" });
  assert.equal(r.status, "empty");
  assert.equal(r.display, "");
  assert.equal(r.e164, null);
});

test("AZ national 050… → polished E.164", () => {
  const r = normalizePersonPhone({ raw: "0501234567", nationalityIso: "AZ" });
  assert.equal(r.status, "polished");
  assert.equal(r.display, "+994501234567");
  assert.equal(r.e164, "+994501234567");
  assert.equal(r.detectedRegion, "AZ");
});

test("AZ national 501… → polished E.164", () => {
  const r = normalizePersonPhone({ raw: "501234567", nationalityIso: "AZ" });
  assert.equal(r.status, "polished");
  assert.equal(r.display, "+994501234567");
});

test("AZ calling-code digits 994… → polished E.164", () => {
  const r = normalizePersonPhone({
    raw: "994501234567",
    nationalityIso: "AZ",
  });
  assert.equal(r.status, "polished");
  assert.equal(r.display, "+994501234567");
  assert.equal(r.e164, "+994501234567");
});

test("AZ already E.164 → unchanged", () => {
  const r = normalizePersonPhone({
    raw: "+994501234567",
    nationalityIso: "AZ",
  });
  assert.equal(r.status, "unchanged");
  assert.equal(r.display, "+994501234567");
});

test("AZ + Russian +7903… → conflict, number kept", () => {
  const r = normalizePersonPhone({
    raw: "+79031234567",
    nationalityIso: "AZ",
  });
  assert.equal(r.status, "conflict");
  assert.equal(r.display, "+79031234567");
  assert.equal(r.e164, "+79031234567");
  assert.equal(r.detectedRegion, "RU");
  assert.equal(r.reasonKey, "conflict");
});

test("empty nationality + national 050 → needs_region", () => {
  const r = normalizePersonPhone({ raw: "0501234567", nationalityIso: "" });
  assert.equal(r.status, "needs_region");
  assert.equal(r.display, "0501234567");
  assert.equal(r.e164, null);
  assert.equal(r.reasonKey, "needs_region");
});

test("KZ national 8705… → polished +7", () => {
  const r = normalizePersonPhone({ raw: "87051234567", nationalityIso: "KZ" });
  assert.equal(r.status, "polished");
  assert.ok(r.display.startsWith("+7"));
  assert.equal(r.e164, r.display);
  assert.equal(r.detectedRegion, "KZ");
});

test("unsupported nationality national digits → needs_region", () => {
  const r = normalizePersonPhone({ raw: "0501234567", nationalityIso: "US" });
  assert.equal(r.status, "needs_region");
  assert.equal(r.display, "0501234567");
});

test("AZ invalid national → invalid", () => {
  const r = normalizePersonPhone({ raw: "123", nationalityIso: "AZ" });
  assert.equal(r.status, "invalid");
  assert.equal(r.reasonKey, "invalid");
});

test("international with empty nationality stays unchanged", () => {
  const r = normalizePersonPhone({
    raw: "+994501234567",
    nationalityIso: null,
  });
  assert.equal(r.status, "unchanged");
  assert.equal(r.display, "+994501234567");
});

test("dedup digits prefer E.164 digits", () => {
  assert.equal(
    personPhoneDedupDigits({ raw: "0501234567", nationalityIso: "AZ" }),
    "994501234567",
  );
});
