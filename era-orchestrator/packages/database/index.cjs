"use strict";

/** CommonJS entry for Nest/runtime — avoids Node ESM issues with index.ts re-exports. */
const prisma = require("./generated/client/index.js");
const pricingModuleSeed = require("./runtime-cjs/core/pricing-module-seed.js");
const pricingBundleSeed = require("./runtime-cjs/core/pricing-bundle-seed.js");
const pricingModuleKeys = require("./runtime-cjs/core/pricing-module-keys.js");
const hotelModuleKeys = require("./runtime-cjs/core/hotel-module-keys.js");
const pricingCatalogCanon = require("./runtime-cjs/core/pricing-catalog-canon.js");

module.exports = {
  ...prisma,
  ...pricingModuleSeed,
  ...pricingBundleSeed,
  ...pricingModuleKeys,
  ...hotelModuleKeys,
  ...pricingCatalogCanon,
};
