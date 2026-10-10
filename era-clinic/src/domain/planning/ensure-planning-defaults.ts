/**
 * Fileless import entity `planning-rules`.
 *
 * Cabins, rotation, substitution, body part, and extended hours are master data
 * (procedure type requirements and /admin/procedure-rules). This import must
 * not rewrite them. A previous version deleted LOCATION rows and wrote
 * fictional RES-VANNA-* codes, and forced rotation and substitution back on.
 */
export type EnsurePlanningDefaultsResult = {
  organizationId: string;
  bodyPartUpdates: number;
  extendedUpdates: number;
  rotations: number;
  substitutions: number;
  cabinPoolLinks: number;
};

export async function ensurePlanningDefaults(
  _db: unknown,
  organizationId: string,
): Promise<EnsurePlanningDefaultsResult> {
  const orgId = organizationId.trim();
  if (!orgId || orgId === "demo-org") {
    throw new Error("organizationId required for ensurePlanningDefaults");
  }
  return {
    organizationId: orgId,
    bodyPartUpdates: 0,
    extendedUpdates: 0,
    rotations: 0,
    substitutions: 0,
    cabinPoolLinks: 0,
  };
}
