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

test("resolveHotelRevenueCode uses the category, otherwise the satellite", () => {
  assert.equal(resolveHotelRevenueCode({ category: "4101", satellite: "4102" }), "4101");
  assert.equal(resolveHotelRevenueCode({ category: "  ", satellite: "4102" }), "4102");
  assert.throws(
    () => resolveHotelRevenueCode({ category: "", satellite: " " }),
    /Hotel revenue code is not configured/,
  );
});
