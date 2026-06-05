/** BullMQ queue for orchestrator → satellite bridge fan-out (separate from finance consumer). */
export const ERA_SATELLITE_FANOUT_QUEUE = "era-satellite-fanout";

export type SatelliteFanoutJobPayload = {
  organizationId: string;
  satelliteKey: string;
  event: Record<string, unknown>;
};
