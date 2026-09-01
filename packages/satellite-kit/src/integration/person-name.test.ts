import test from "node:test";
import assert from "node:assert/strict";
import {
  composePersonFullName,
  splitFullNameToParts,
  mergePersonNameParts,
  normalizeNationalityIso,
  hasPersonNameInput,
} from "./person-name.js";

test("split Ali Vali Mammadov", () => {
  assert.deepEqual(splitFullNameToParts("Ali Vali Mammadov"), {
    firstName: "Ali",
    middleName: "Vali",
    lastName: "Mammadov",
  });
});

test("fill-not-clear middle", () => {
  const m = mergePersonNameParts(
    { firstName: "Ali", middleName: "Vali", lastName: "Mammadov" },
    splitFullNameToParts("Ali Mammadov"),
  );
  assert.equal(m.middleName, "Vali");
  assert.equal(m.fullName, "Ali Vali Mammadov");
});

test("nationality ISO", () => {
  assert.equal(normalizeNationalityIso("OTHER"), null);
  assert.equal(normalizeNationalityIso("kz"), "KZ");
});

test("hasPersonNameInput", () => {
  assert.equal(hasPersonNameInput({ firstName: "Ali", lastName: "Mammadov" }), true);
  assert.equal(hasPersonNameInput({ fullName: "Ali" }), true);
  assert.equal(hasPersonNameInput({ firstName: "Ali" }), false);
});

test("compose", () => {
  assert.equal(composePersonFullName("Ali", null, "Mammadov"), "Ali Mammadov");
});
