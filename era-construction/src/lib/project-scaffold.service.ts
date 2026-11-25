/**
 * Wave 1 stub surface — Wave 3 depth lives in project-depth.service.
 * Re-export list/create helpers so older Nest stubs keep compiling.
 */
export {
  listParties,
  createParty,
  listPhases,
  createPhase,
  listLocations,
  createLocation,
  listRfis,
  createRfi,
  listSubmittals,
  createSubmittal,
  listInspections,
  createInspection,
  listChangeRequests,
  createChangeRequest,
} from "@/lib/project-depth.service";
