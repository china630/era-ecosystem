/** Pure master-data gates (AC-CLI-MD). */

export function inactiveCatalogDenied(active: boolean | null | undefined, label = "Catalog item"): string | null {
  if (active === false) return `${label} is inactive`;
  return null;
}

export function practitionerBookableDenied(input: {
  found: boolean;
  active?: boolean | null;
}): string | null {
  if (!input.found) return "Practitioner not found";
  if (input.active === false) return "Practitioner is inactive";
  return null;
}
