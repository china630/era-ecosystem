/** Pure material requisition gates (AC-CON-MAT negative paths). */

export function materialRequisitionDenied(
  project: { id: string } | null | undefined,
): string | null {
  if (!project) return "Project not found";
  return null;
}
