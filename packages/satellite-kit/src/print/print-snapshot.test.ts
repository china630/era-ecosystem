import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
  FINANCE_INVOICE_COMMERCIAL_LINE_WHITELIST,
  interpolatePrintTemplate,
  normalizePrintLang,
  type PrintSnapshot,
} from "./print-snapshot";

const snap: PrintSnapshot = {
  blankId: "FINANCE_INVOICE_COMMERCIAL",
  version: 1,
  lang: "az",
  capturedAt: "2026-09-18T00:00:00.000Z",
  values: {
    "org.name": "Acme",
    "invoice.number": "INV-1",
    "invoice.total": "100.0000",
  },
  lines: [
    {
      "line.description": "Widget",
      "line.qty": "2",
      "line.unitPrice": "50.0000",
      "line.vatRate": "18",
      "line.lineTotal": "100.0000",
      "line.sku": "W1",
    },
  ],
};

describe("interpolatePrintTemplate", () => {
  it("rejects unknown placeholders", () => {
    const r = interpolatePrintTemplate(
      "<p>{{org.name}}</p><p>{{evil.query}}</p>",
      snap,
      FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
    );
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.issue.code, "PRINT_UNKNOWN_PLACEHOLDER");
      assert.deepEqual(r.issue.keys, ["evil.query"]);
    }
  });

  it("interpolates known values and escapes HTML", () => {
    const s: PrintSnapshot = {
      ...snap,
      values: { ...snap.values, "org.name": "<Acme>" },
    };
    const r = interpolatePrintTemplate(
      "<h1>{{org.name}}</h1><p>{{invoice.number}}</p>",
      s,
      FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.match(r.html, /&lt;Acme&gt;/);
      assert.match(r.html, /INV-1/);
    }
  });

  it("renders lines loop", () => {
    const r = interpolatePrintTemplate(
      "<table>{{#lines}}<tr><td>{{line.description}}</td><td>{{line.qty}}</td></tr>{{/lines}}</table>",
      snap,
      FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
      FINANCE_INVOICE_COMMERCIAL_LINE_WHITELIST,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.match(r.html, /Widget/);
      assert.match(r.html, />2</);
    }
  });

  it("rejects nested lines loops", () => {
    const r = interpolatePrintTemplate(
      "{{#lines}}{{#lines}}x{{/lines}}{{/lines}}",
      snap,
      FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
      FINANCE_INVOICE_COMMERCIAL_LINE_WHITELIST,
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issue.code, "PRINT_NESTED_LOOP");
  });

  it("rejects a second sequential lines loop", () => {
    const r = interpolatePrintTemplate(
      "{{#lines}}{{line.qty}}{{/lines}}{{#lines}}{{line.qty}}{{/lines}}",
      snap,
      FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
      FINANCE_INVOICE_COMMERCIAL_LINE_WHITELIST,
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issue.code, "PRINT_NESTED_LOOP");
  });

  it("does not interpolate extra.unknown", () => {
    const r = interpolatePrintTemplate(
      "<p>{{extra.unknown}}</p>",
      snap,
      FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
    );
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.issue.code, "PRINT_UNKNOWN_PLACEHOLDER");
      assert.deepEqual(r.issue.keys, ["extra.unknown"]);
    }
  });

  it("rejects unknown line placeholders", () => {
    const r = interpolatePrintTemplate(
      "{{#lines}}{{line.hack}}{{/lines}}",
      snap,
      FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
      FINANCE_INVOICE_COMMERCIAL_LINE_WHITELIST,
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issue.code, "PRINT_UNKNOWN_PLACEHOLDER");
  });

  it("leaves missing values empty", () => {
    const r = interpolatePrintTemplate(
      "<p>{{org.taxId}}</p>",
      snap,
      FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.html, "<p></p>");
  });
});

describe("normalizePrintLang", () => {
  it("maps ru/en/az", () => {
    assert.equal(normalizePrintLang("ru-RU"), "ru");
    assert.equal(normalizePrintLang("en"), "en");
    assert.equal(normalizePrintLang(undefined), "az");
  });
});
