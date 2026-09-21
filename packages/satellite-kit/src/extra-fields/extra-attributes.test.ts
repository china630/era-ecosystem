import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertExtraFieldKey,
  defaultCatalogFieldKind,
  normalizeExtraAttributes,
  type ExtraFieldDefinitionView,
} from "./extra-attributes";

const plate: ExtraFieldDefinitionView = {
  key: "vehicle_plate",
  valueKind: "TEXT",
  catalogFieldKind: "FREE_TEXT",
  required: false,
  active: true,
};

const region: ExtraFieldDefinitionView = {
  key: "region",
  valueKind: "SELECT",
  catalogFieldKind: "CLOSED_SMALL",
  required: true,
  active: true,
  options: [{ value: "BAKU" }, { value: "GANJA" }],
};

describe("normalizeExtraAttributes", () => {
  it("rejects unknown keys", () => {
    const r = normalizeExtraAttributes([plate], { vehicle_plate: "10-AA-100", driver: "X" });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.issue.code, "EXTRA_FIELD_UNKNOWN_KEY");
      assert.deepEqual(r.issue.keys, ["driver"]);
    }
  });

  it("keeps known values and drops empty optional", () => {
    const r = normalizeExtraAttributes([plate], { vehicle_plate: "10-AA-100" });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.value, { vehicle_plate: "10-AA-100" });
  });

  it("requires active required fields", () => {
    const r = normalizeExtraAttributes([region], {});
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issue.code, "EXTRA_FIELD_REQUIRED");
  });

  it("validates select options", () => {
    const r = normalizeExtraAttributes([region], { region: "SUMQAYIT" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issue.code, "EXTRA_FIELD_TYPE");
  });

  it("strips retired keys and keeps active values", () => {
    const r = normalizeExtraAttributes(
      [{ ...plate, active: false }, region],
      { region: "BAKU", vehicle_plate: "x" },
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.value, { region: "BAKU" });
  });

  it("still rejects keys that were never defined", () => {
    const r = normalizeExtraAttributes([region], { region: "BAKU", driver: "X" });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.issue.code, "EXTRA_FIELD_UNKNOWN_KEY");
      assert.deepEqual(r.issue.keys, ["driver"]);
    }
  });

  it("rejects impossible calendar dates", () => {
    const dateDef: ExtraFieldDefinitionView = {
      key: "load_date",
      valueKind: "DATE",
      catalogFieldKind: "FREE_TEXT",
      required: false,
      active: true,
    };
    const r = normalizeExtraAttributes([dateDef], { load_date: "2026-02-31" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issue.code, "EXTRA_FIELD_TYPE");
  });

  it("trims text values", () => {
    const r = normalizeExtraAttributes([plate], { vehicle_plate: "  10-AA-100  " });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.value, { vehicle_plate: "10-AA-100" });
  });

  it("keeps required boolean false", () => {
    const flag: ExtraFieldDefinitionView = {
      key: "bonded",
      valueKind: "BOOLEAN",
      catalogFieldKind: "CLOSED_SMALL",
      required: true,
      active: true,
    };
    const r = normalizeExtraAttributes([flag], { bonded: false });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.value, { bonded: false });
  });
});

describe("assertExtraFieldKey", () => {
  it("accepts snake_case", () => {
    assert.equal(assertExtraFieldKey("vehicle_plate"), null);
  });
  it("rejects uppercase", () => {
    const r = assertExtraFieldKey("Vehicle");
    assert.ok(r && !r.ok);
  });
});

describe("defaultCatalogFieldKind", () => {
  it("maps SELECT to CLOSED_SMALL", () => {
    assert.equal(defaultCatalogFieldKind("SELECT"), "CLOSED_SMALL");
    assert.equal(defaultCatalogFieldKind("TEXT"), "FREE_TEXT");
  });
});
