import assert from "node:assert/strict";
import test from "node:test";
import {
  HOTEL_REVENUE_CODES_PATH,
  HOTEL_REVENUE_CODES_PERMISSION,
  resolveHotelRevenueCode,
  sharedApiPermission,
} from "./hotel-revenue-route";

test("exact hotel revenue path wins over a query string", () => {
  assert.equal(
    sharedApiPermission(`${HOTEL_REVENUE_CODES_PATH}?x=1`),
    HOTEL_REVENUE_CODES_PERMISSION,
  );
  assert.equal(sharedApiPermission("/api/admin/hotel-revenue-codes/"), HOTEL_REVENUE_CODES_PERMISSION);
  assert.equal(sharedApiPermission("/api/admin/other"), null);
});

test("resolveHotelRevenueCode prefers product, then category, then satellite", () => {
  assert.equal(
    resolveHotelRevenueCode({ product: "13", category: "14", satellite: "15" }),
    "13",
  );
  assert.equal(
    resolveHotelRevenueCode({ product: "  ", category: "14", satellite: "15" }),
    "14",
  );
  assert.equal(resolveHotelRevenueCode({ product: "", category: "", satellite: "15" }), "15");
  assert.throws(
    () => resolveHotelRevenueCode({ product: "", category: null, satellite: " " }),
    /Hotel revenue code is not configured/,
  );
});
