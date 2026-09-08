import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeListPagination,
  parsePaginatedList,
} from "./paginated-list.js";

describe("parsePaginatedList", () => {
  it("parses items envelope", () => {
    const r = parsePaginatedList<{ id: string }>({
      items: [{ id: "a" }],
      total: 10,
      page: 2,
      pageSize: 25,
    });
    assert.equal(r.items.length, 1);
    assert.equal(r.total, 10);
    assert.equal(r.page, 2);
    assert.equal(r.pageSize, 25);
  });

  it("parses clinic data array", () => {
    const r = parsePaginatedList({ data: [{ id: 1 }], total: 3, page: 1, pageSize: 25 });
    assert.equal(r.items.length, 1);
    assert.equal(r.total, 3);
  });

  it("parses nested clinic { data: { data, total } }", () => {
    const r = parsePaginatedList({
      data: { data: [{ id: 1 }, { id: 2 }], total: 2, page: 1, pageSize: 25 },
    });
    assert.equal(r.items.length, 2);
    assert.equal(r.total, 2);
  });

  it("parses legacy array", () => {
    const r = parsePaginatedList([{ id: 1 }, { id: 2 }]);
    assert.equal(r.items.length, 2);
    assert.equal(r.total, 2);
  });
});

describe("normalizeListPagination", () => {
  it("snaps to allowed page sizes", () => {
    assert.deepEqual(normalizeListPagination(2, 50), {
      page: 2,
      pageSize: 50,
      skip: 50,
    });
    assert.equal(normalizeListPagination(1, 100).pageSize, 100);
    assert.equal(normalizeListPagination(1, 7).pageSize, 25);
    assert.equal(normalizeListPagination(0, 25).page, 1);
  });
});
