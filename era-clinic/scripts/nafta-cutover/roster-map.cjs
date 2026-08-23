"use strict";

const { mapRosterRow } = require("./map.cjs");

/** Job title → ERA workforce satellites (clinic vs hotel front office). */
function satellitesForTitle(title, dept) {
  return mapRosterRow({ "Vəzifə": title, "Şöbə": dept }).satellites;
}

module.exports = { mapRosterRow, satellitesForTitle };
