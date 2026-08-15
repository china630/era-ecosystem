/**
 * Smoke: CatalogFieldKind → control contract (Phase 0 F2).
 * Run from repo root: node packages/satellite-kit/scripts/catalog-field-kind.smoke.cjs
 */
const {
  assertCatalogAllowsPlainText,
  inferCatalogFieldKind,
  resolveCatalogControl,
} = require("../dist/ui/catalog-field-kind.js");

function main() {
  const closed = resolveCatalogControl("CLOSED_SMALL");
  if (closed.allowPlainText || closed.control !== "select") {
    throw new Error("CLOSED_SMALL must be select and forbid plain text");
  }
  const free = resolveCatalogControl("FREE_TEXT");
  if (!free.allowPlainText || free.control !== "text") {
    throw new Error("FREE_TEXT must allow plain text");
  }
  assertCatalogAllowsPlainText("FREE_TEXT");
  let threw = false;
  try {
    assertCatalogAllowsPlainText("CLOSED_SMALL");
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("assertCatalogAllowsPlainText(CLOSED_SMALL) must throw");

  if (inferCatalogFieldKind({ optionCount: 3, opsHot: true }) !== "OPS_HOT") {
    throw new Error("infer OPS_HOT failed");
  }
  if (inferCatalogFieldKind({ optionCount: 20 }) !== "CLOSED_MEDIUM") {
    throw new Error("infer CLOSED_MEDIUM failed");
  }
  console.log("catalog-field-kind smoke OK");
}

main();
