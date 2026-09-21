import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSavedListViewGridKey,
  normalizeSavedListView,
  type SavedListViewSchema,
} from "./saved-list-view";

const schema: SavedListViewSchema = {
  gridKey: "FINANCE_INVOICE_LIST",
  columns: [
    "number",
    "counterparty",
    "status",
    "dueDate",
    "totalAmount",
    "actions",
  ],
  requiredColumns: ["actions"],
  retiredColumns: ["legacyCol"],
  filters: ["status", "counterpartyId", "dueFrom", "dueTo"],
  sortKeys: ["createdAt", "dueDate", "number", "totalAmount", "status"],
  defaultSort: { key: "createdAt", dir: "desc" },
};

describe("normalizeSavedListView", () => {
  it("rejects unknown column keys", () => {
    const r = normalizeSavedListView(schema, {
      version: 1,
      columns: ["number", "driver"],
      filters: {},
      pageSize: 25,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.issue.code, "SAVED_VIEW_UNKNOWN_KEY");
      assert.deepEqual(r.issue.keys, ["driver"]);
    }
  });

  it("rejects empty columns", () => {
    const r = normalizeSavedListView(schema, {
      columns: [],
      filters: {},
      pageSize: 25,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issue.code, "SAVED_VIEW_EMPTY_COLUMNS");
  });

  it("strips retired columns and keeps required actions", () => {
    const r = normalizeSavedListView(schema, {
      columns: ["number", "legacyCol"],
      filters: {},
      pageSize: 25,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.value.columns, ["number", "actions"]);
      assert.equal(r.value.pageSize, 25);
      assert.deepEqual(r.value.sort, { key: "createdAt", dir: "desc" });
    }
  });

  it("rejects unknown filter keys", () => {
    const r = normalizeSavedListView(schema, {
      columns: ["number", "actions"],
      filters: { status: "SENT", extraAttr: "x" },
      pageSize: 25,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.issue.code, "SAVED_VIEW_UNKNOWN_KEY");
      assert.deepEqual(r.issue.keys, ["extraAttr"]);
    }
  });

  it("rejects unknown sort key", () => {
    const r = normalizeSavedListView(schema, {
      columns: ["number", "actions"],
      filters: {},
      sort: { key: "extraAttributes", dir: "asc" },
      pageSize: 25,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issue.code, "SAVED_VIEW_UNKNOWN_KEY");
  });

  it("snaps pageSize to 25/50/100", () => {
    const r = normalizeSavedListView(schema, {
      columns: ["number", "actions"],
      filters: { status: "DRAFT" },
      sort: { key: "dueDate", dir: "asc" },
      pageSize: 40,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.ok([25, 50, 100].includes(r.value.pageSize));
      assert.deepEqual(r.value.filters, { status: "DRAFT" });
      assert.deepEqual(r.value.sort, { key: "dueDate", dir: "asc" });
    }
  });
});

describe("assertSavedListViewGridKey", () => {
  it("accepts known grid", () => {
    assert.equal(
      assertSavedListViewGridKey("FINANCE_INVOICE_LIST", ["FINANCE_INVOICE_LIST"]),
      null,
    );
  });
  it("rejects unknown grid", () => {
    const r = assertSavedListViewGridKey("OTHER", ["FINANCE_INVOICE_LIST"]);
    assert.ok(r && !r.ok);
  });
});
