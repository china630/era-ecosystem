import { controlPlaneDiagnostics } from "../control-plane/control-plane-credentials";

/** Unified liveness: GET /api/health and legacy GET /health. */
export const HEALTH_CHECK_PAYLOAD = {
  status: "ok",
  service: "erafinance-api",
} as const;

/** Safe control-plane diagnostics (no secret values). */
export function healthCheckWithDiagnostics() {
  return {
    ...HEALTH_CHECK_PAYLOAD,
    controlPlane: controlPlaneDiagnostics(),
  };
}
