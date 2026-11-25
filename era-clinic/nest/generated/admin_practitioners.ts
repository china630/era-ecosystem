/**
 * Practitioner hire marker for the workforce dual-path audit.
 * POST /api/admin/practitioners is served by ClinicNativeModule
 * (AdminPractitionersController) and refuses local create with WORKFORCE_HIRE_VIA_CP.
 */
export const CLINIC_PRACTITIONER_HIRE = "WORKFORCE_HIRE_VIA_CP";
